import { GoogleGenerativeAI } from '@google/generative-ai';
import { json, sha256Hex, limpiarJsonModelo } from './_lib.js';
import { IDIOMAS } from '../../src/data/idiomas.js';

const MODEL_NAME = 'gemini-flash-latest';

// Límites para acotar el coste de una petición a este endpoint público (sin autenticar):
// nadie necesita traducir más texto que el de una página del sitio de una sola vez.
const MAX_TEXTOS = 400;
const MAX_CARACTERES_POR_TEXTO = 2000;
const MAX_CARACTERES_TOTAL = 40000;

// La mayoría de páginas del sitio caben en un único lote: partir en lotes más pequeños de
// forma sistemática multiplicaría las llamadas a Gemini (una por lote) y con la cuota gratuita
// del modelo tan ajustada (ver README) eso es contraproducente. Solo se trocea cuando una
// página es inusualmente grande, para acotar el tamaño de un único prompt/respuesta.
const TAMANO_LOTE = 80;
const CONCURRENCIA_MAXIMA = 3;
const REINTENTOS_MAXIMOS = 2;
const TIMEOUT_MS = 20000;

const IDIOMAS_POR_CODIGO = new Map(IDIOMAS.map((idioma) => [idioma.codigo, idioma]));

function razonBodyInvalido(body) {
	if (!body || typeof body !== 'object') return 'Body no es un objeto JSON';
	if (typeof body.ruta !== 'string' || !body.ruta.trim()) return 'Falta "ruta"';
	if (typeof body.idioma !== 'string' || !IDIOMAS_POR_CODIGO.has(body.idioma)) return `Idioma "${body.idioma}" no soportado`;
	if (!Array.isArray(body.textos) || body.textos.length === 0) return 'Falta "textos" (array no vacío)';
	if (body.textos.length > MAX_TEXTOS) return `Demasiados textos (máximo ${MAX_TEXTOS})`;
	if (!body.textos.every((texto) => typeof texto === 'string' && texto.length <= MAX_CARACTERES_POR_TEXTO)) {
		return `Cada texto debe ser un string de máximo ${MAX_CARACTERES_POR_TEXTO} caracteres`;
	}

	const totalCaracteres = body.textos.reduce((suma, texto) => suma + texto.length, 0);
	if (totalCaracteres > MAX_CARACTERES_TOTAL) return `Demasiado texto en total (máximo ${MAX_CARACTERES_TOTAL} caracteres)`;

	return null;
}

function esDesarrollo(request) {
	try {
		return new URL(request.url).hostname === 'localhost';
	} catch {
		return false;
	}
}

function construirPrompt(textos, idiomaInfo) {
	return `Traduce cada elemento del siguiente array JSON de textos de una página web al idioma ${idiomaInfo.nombre} (código "${idiomaInfo.codigo}").

Reglas estrictas:
- Devuelve EXCLUSIVAMENTE un array JSON válido, con exactamente ${textos.length} elementos, en el mismo orden que el original.
- No traduzcas nombres propios, marcas, nombres de tecnologías (Python, SQL, R, Power BI, Astro, GitHub, etc.), URLs, direcciones de correo, ni datos numéricos o fechas.
- Si un elemento ya está vacío, o son solo símbolos o números, devuélvelo tal cual.
- No añadas texto antes ni después del array. No uses bloques de código markdown.

Array original:
${JSON.stringify(textos)}`;
}

function dividirEnLotes(items, tamano) {
	const lotes = [];
	for (let i = 0; i < items.length; i += tamano) lotes.push(items.slice(i, i + tamano));
	return lotes;
}

function esperar(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

// El SDK de Gemini mete el status HTTP y, en errores de cuota, un "retryDelay" sugerido dentro
// del propio texto del mensaje de error (no como campos estructurados), así que se extraen con
// regex en vez de depender de una forma de error más rica que este SDK no expone.
function extraerStatusHttp(error) {
	const coincidencia = String(error?.message ?? '').match(/\[(\d{3})\s/);
	return coincidencia ? Number(coincidencia[1]) : null;
}

function extraerRetryDelayMs(error) {
	const coincidencia = String(error?.message ?? '').match(/"retryDelay":"(\d+(?:\.\d+)?)s"/);
	return coincidencia ? Number(coincidencia[1]) * 1000 : null;
}

function esReintentable(status) {
	return status === 429 || (status !== null && status >= 500 && status < 600);
}

async function llamarGeminiConReintentos(model, prompt) {
	let ultimoError;

	for (let intento = 0; intento <= REINTENTOS_MAXIMOS; intento++) {
		const controlador = new AbortController();
		const idTimeout = setTimeout(() => controlador.abort(), TIMEOUT_MS);

		try {
			const resultado = await model.generateContent(prompt, { signal: controlador.signal, timeout: TIMEOUT_MS });
			return resultado.response.text();
		} catch (error) {
			ultimoError = error;
			const status = extraerStatusHttp(error);

			if (intento === REINTENTOS_MAXIMOS || !esReintentable(status)) throw error;

			const espera = extraerRetryDelayMs(error) ?? 1000 * 2 ** intento;
			await esperar(Math.min(espera, 5000));
		} finally {
			clearTimeout(idTimeout);
		}
	}

	throw ultimoError;
}

/**
 * Traduce un lote. Nunca lanza: si falla (cuota agotada, timeout, formato inesperado...) se
 * queda con los textos originales para ese lote en vez de tirar abajo toda la petición, y lo
 * marca con ok:false para que la llamada que agrega los lotes sepa que hubo degradación.
 */
async function traducirLote(model, textosLote, idiomaInfo) {
	try {
		const texto = await llamarGeminiConReintentos(model, construirPrompt(textosLote, idiomaInfo));
		const traducidas = limpiarJsonModelo(texto);

		if (!Array.isArray(traducidas) || traducidas.length !== textosLote.length) {
			throw new Error('Traducción con formato inesperado');
		}

		return { ok: true, traducciones: traducidas };
	} catch (error) {
		console.error(`No se pudo traducir un lote de ${textosLote.length} texto(s) a "${idiomaInfo.codigo}":`, error);
		return { ok: false, traducciones: textosLote, error };
	}
}

async function procesarConcurrencia(items, procesar, concurrenciaMaxima) {
	const resultados = new Array(items.length);
	let siguiente = 0;

	async function trabajador() {
		while (siguiente < items.length) {
			const indice = siguiente++;
			resultados[indice] = await procesar(items[indice]);
		}
	}

	const trabajadores = Array.from({ length: Math.min(concurrenciaMaxima, items.length) }, trabajador);
	await Promise.all(trabajadores);
	return resultados;
}

/**
 * @returns {Promise<{ traducciones: string[], huboExito: boolean, parcial: boolean }>}
 */
async function traducirTextos(env, textos, idiomaInfo) {
	const model = new GoogleGenerativeAI(env.GEMINI_API_KEY).getGenerativeModel({ model: MODEL_NAME });
	const lotes = dividirEnLotes(textos, TAMANO_LOTE);

	const resultados = await procesarConcurrencia(lotes, (lote) => traducirLote(model, lote, idiomaInfo), CONCURRENCIA_MAXIMA);

	return {
		traducciones: resultados.flatMap((r) => r.traducciones),
		huboExito: resultados.some((r) => r.ok),
		parcial: resultados.some((r) => !r.ok),
	};
}

export async function onRequestPost({ request, env }) {
	if (!env.DB) {
		return json({ ok: false, error: 'Falta el binding DB' }, 500);
	}
	if (!env.GEMINI_API_KEY) {
		return json({ ok: false, error: 'Falta configurar GEMINI_API_KEY' }, 500);
	}

	let body;
	try {
		body = await request.json();
	} catch {
		return json({ ok: false, error: 'Body no es JSON válido' }, 400);
	}

	const razonInvalida = razonBodyInvalido(body);
	if (razonInvalida) {
		return json({ ok: false, error: razonInvalida }, 400);
	}

	const { ruta, idioma, textos } = body;
	const idiomaInfo = IDIOMAS_POR_CODIGO.get(idioma);
	const hashContenido = await sha256Hex(JSON.stringify(textos));

	try {
		const filaCache = await env.DB.prepare(
			'SELECT contenido_json FROM traducciones_cache WHERE ruta = ? AND idioma = ? AND hash_contenido = ?',
		)
			.bind(ruta, idioma, hashContenido)
			.first();

		if (filaCache) {
			return json({ ok: true, traducciones: JSON.parse(filaCache.contenido_json) });
		}
	} catch (error) {
		// Si la tabla de caché aún no existe o falla la lectura, seguimos sin caché en vez de
		// romper la traducción: es una degradación aceptable, no un error fatal.
		console.error('No se pudo leer la caché de traducciones:', error);
	}

	const resultado = await traducirTextos(env, textos, idiomaInfo);

	if (!resultado.huboExito) {
		const detalle = esDesarrollo(request) ? { detalle: 'Todos los lotes fallaron; ver logs del Worker para el error exacto de cada uno' } : {};
		return json({ ok: false, error: 'El proveedor de traducción no respondió', ...detalle }, 502);
	}

	// Un resultado parcial no se cachea: si se guardara, el próximo visitante recibiría para
	// siempre la misma mezcla de texto traducido/original en vez de reintentarlo cuando la
	// cuota ya se haya recuperado.
	if (!resultado.parcial) {
		try {
			await env.DB.prepare(
				'INSERT OR IGNORE INTO traducciones_cache (ruta, idioma, hash_contenido, contenido_json) VALUES (?, ?, ?, ?)',
			)
				.bind(ruta, idioma, hashContenido, JSON.stringify(resultado.traducciones))
				.run();
		} catch (error) {
			console.error('No se pudo guardar la traducción en caché:', error);
		}
	}

	return json({ ok: true, traducciones: resultado.traducciones, parcial: resultado.parcial });
}

export async function onRequest() {
	return json({ ok: false, error: 'Solo POST por ahora' }, 405);
}
