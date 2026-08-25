import { GoogleGenerativeAI } from '@google/generative-ai';
import { json, sha256Hex, limpiarJsonModelo } from './_lib.js';
import { IDIOMAS } from '../../src/data/idiomas.js';

const MODEL_NAME = 'gemini-flash-latest';

// Límites para acotar el coste de una petición a este endpoint público (sin autenticar):
// nadie necesita traducir más texto que el de una página del sitio de una sola vez.
const MAX_TEXTOS = 400;
const MAX_CARACTERES_POR_TEXTO = 2000;
const MAX_CARACTERES_TOTAL = 40000;

const IDIOMAS_POR_CODIGO = new Map(IDIOMAS.map((idioma) => [idioma.codigo, idioma]));

function esBodyValido(body) {
	if (!body || typeof body !== 'object') return false;
	if (typeof body.ruta !== 'string' || !body.ruta.trim()) return false;
	if (typeof body.idioma !== 'string' || !IDIOMAS_POR_CODIGO.has(body.idioma)) return false;
	if (!Array.isArray(body.textos) || body.textos.length === 0 || body.textos.length > MAX_TEXTOS) return false;
	if (!body.textos.every((texto) => typeof texto === 'string' && texto.length <= MAX_CARACTERES_POR_TEXTO)) return false;

	const totalCaracteres = body.textos.reduce((suma, texto) => suma + texto.length, 0);
	if (totalCaracteres > MAX_CARACTERES_TOTAL) return false;

	return true;
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

async function traducirTextos(env, textos, idiomaInfo) {
	const apiKey = env.GEMINI_API_KEY;
	if (!apiKey) throw new Error('Falta GEMINI_API_KEY');

	const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: MODEL_NAME });
	const resultado = await model.generateContent(construirPrompt(textos, idiomaInfo));
	const traducciones = limpiarJsonModelo(resultado.response.text());

	if (!Array.isArray(traducciones) || traducciones.length !== textos.length) {
		throw new Error('Traducción con formato inesperado');
	}

	return traducciones;
}

export async function onRequestPost({ request, env }) {
	if (!env.DB) {
		return json({ ok: false, error: 'Falta el binding DB' }, 500);
	}

	let body;
	try {
		body = await request.json();
	} catch {
		return json({ ok: false, error: 'Body no es JSON válido' }, 400);
	}

	if (!esBodyValido(body)) {
		return json({ ok: false, error: 'Formato de body inesperado' }, 400);
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

	let traducciones;
	try {
		traducciones = await traducirTextos(env, textos, idiomaInfo);
	} catch (error) {
		console.error(`No se pudo traducir a "${idioma}":`, error);
		return json({ ok: false, error: 'No se pudo generar la traducción' }, 502);
	}

	try {
		await env.DB.prepare(
			'INSERT OR IGNORE INTO traducciones_cache (ruta, idioma, hash_contenido, contenido_json) VALUES (?, ?, ?, ?)',
		)
			.bind(ruta, idioma, hashContenido, JSON.stringify(traducciones))
			.run();
	} catch (error) {
		console.error('No se pudo guardar la traducción en caché:', error);
	}

	return json({ ok: true, traducciones });
}

export async function onRequest() {
	return json({ ok: false, error: 'Solo POST por ahora' }, 405);
}
