// Rellena las traducciones que falten en src/i18n/<lang>/*.json para los idiomas nuevos del
// selector de idioma (todo src/data/idiomas.js salvo es/en), usando el español como fuente de
// verdad. Idempotente: cachea un hash del texto origen por clave en src/i18n/<lang>/.cache.json,
// así que solo se traduce lo que es nuevo o ha cambiado desde la última ejecución.
//
// Uso:
//   GEMINI_API_KEY=... npm run translate
//
// Usa el mismo proveedor, modelo y cliente que src/lib/descripciones.js (Gemini,
// @google/generative-ai, gemini-2.5-flash-lite) para no depender de ninguna otra API key. Comparte
// también su límite: el tramo gratuito de Gemini admite ~15 peticiones/minuto, así que aquí TODO
// el proceso es estrictamente secuencial (una llamada a la vez, con el mismo margen de espera
// entre llamadas), nunca en paralelo.
//
// La API key solo hace falta para ejecutar este script en build/local; el sitio generado es
// 100% estático y no depende de ella en producción.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { IDIOMAS } from '../src/data/idiomas.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const MODEL_NAME = 'gemini-3.5-flash-lite';
const LOTE_MAXIMO = 60;
const REINTENTOS_MAXIMOS = 3;
// Igual que src/lib/descripciones.js: margen prudente por debajo del límite del free tier de
// Gemini (15 req/min).
const RATE_LIMIT_DELAY_MS = 4500;

const NEW_LOCALES = IDIOMAS.map((idioma) => idioma.codigo);

// inicio/sobre-mi/experiencia en ES viven en src/data/ (el panel privado los lee/escribe ahí
// directamente vía GitHub, ver functions/api/guardar.js); el resto vive en src/i18n/es/.
const PANEL_PAGES = new Set(['inicio', 'sobre-mi', 'experiencia']);
const PAGES = ['common', 'inicio', 'sobre-mi', 'experiencia', 'proyectos', 'contacto', 'politica-cookies', 'politica-privacidad', '404'];

// Compartido a nivel de módulo (no dentro de una función por idioma) para que el margen entre
// llamadas se respete entre TODAS las llamadas del proceso, sin importar idioma o página —
// mismo patrón que descripciones.js.
let seHaLlamadoAGeminiEnEsteProceso = false;

// Gemini devuelve 429 tanto para el límite de peticiones/minuto (transitorio: espera unos
// segundos y funciona, normalmente trae un "retryDelay" corto) como para el límite diario del
// tramo gratuito (no transitorio: reintentar ahora no sirve de nada hasta que resetee mañana).
// Se distinguen por si el 429 trae retryDelay y es razonablemente corto; si no, se asume cuota
// diaria agotada y se para TODO el script en vez de reintentar en vano durante horas.
const RETRY_DELAY_MAX_TRANSITORIO_MS = 30000;

class CuotaAgotadaError extends Error {}

function extraerStatusHttp(error) {
	const coincidencia = String(error?.message ?? '').match(/\[(\d{3})\s/);
	return coincidencia ? Number(coincidencia[1]) : null;
}

function extraerRetryDelayMs(error) {
	const coincidencia = String(error?.message ?? '').match(/"retryDelay":"(\d+(?:\.\d+)?)s"/);
	return coincidencia ? Number(coincidencia[1]) * 1000 : null;
}

function esCuotaDiariaAgotada(status, retryDelayMs) {
	return status === 429 && (retryDelayMs === null || retryDelayMs > RETRY_DELAY_MAX_TRANSITORIO_MS);
}

function rutaOrigenEs(page) {
	return PANEL_PAGES.has(page) ? path.join(ROOT, 'src', 'data', `${page}.json`) : path.join(ROOT, 'src', 'i18n', 'es', `${page}.json`);
}

function rutaDestino(lang, page) {
	return path.join(ROOT, 'src', 'i18n', lang, `${page}.json`);
}

function rutaCache(lang) {
	return path.join(ROOT, 'src', 'i18n', lang, '.cache.json');
}

function leerJson(ruta) {
	if (!existsSync(ruta)) return null;
	try {
		return JSON.parse(readFileSync(ruta, 'utf-8'));
	} catch (error) {
		console.error(`No se pudo leer ${ruta}, se ignora:`, error);
		return null;
	}
}

function escribirJson(ruta, datos) {
	mkdirSync(path.dirname(ruta), { recursive: true });
	writeFileSync(ruta, `${JSON.stringify(datos, null, '\t')}\n`, 'utf-8');
}

function sha256(texto) {
	return createHash('sha256').update(texto, 'utf-8').digest('hex');
}

/** Recorre un JSON y recoge cada string hoja como { path, value }, path = array de claves/índices. */
function recogerHojas(valor, rutaActual = [], salida = []) {
	if (typeof valor === 'string') {
		salida.push({ path: rutaActual, value: valor });
	} else if (Array.isArray(valor)) {
		valor.forEach((item, i) => recogerHojas(item, [...rutaActual, i], salida));
	} else if (valor && typeof valor === 'object') {
		for (const [clave, v] of Object.entries(valor)) recogerHojas(v, [...rutaActual, clave], salida);
	}
	return salida;
}

function fijarEnRuta(objeto, rutaClaves, valor) {
	let actual = objeto;
	for (let i = 0; i < rutaClaves.length - 1; i++) actual = actual[rutaClaves[i]];
	actual[rutaClaves[rutaClaves.length - 1]] = valor;
}

function dividirEnLotes(items, tamano) {
	const lotes = [];
	for (let i = 0; i < items.length; i += tamano) lotes.push(items.slice(i, i + tamano));
	return lotes;
}

function esperar(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function limpiarJsonModelo(texto) {
	const sinFences = texto
		.trim()
		.replace(/^```(?:json)?/i, '')
		.replace(/```$/, '')
		.trim();
	return JSON.parse(sinFences);
}

function construirPrompt(textos, idiomaInfo) {
	return `Traduce cada elemento del siguiente array JSON de textos de una página web al idioma ${idiomaInfo.nombre} (código ISO "${idiomaInfo.codigo}").

Reglas estrictas:
- Devuelve EXCLUSIVAMENTE un array JSON válido, con exactamente ${textos.length} elementos, en el mismo orden que el original.
- No traduzcas nombres propios, marcas, nombres de tecnologías (Python, SQL, R, Power BI, Astro, GitHub, etc.), URLs, rutas (empiezan por "/"), direcciones de correo, ni datos numéricos o fechas.
- Si un elemento ya está vacío, o son solo símbolos, una ruta o un número, devuélvelo tal cual.
- No añadas texto antes ni después del array. No uses bloques de código markdown.

Array original:
${JSON.stringify(textos)}`;
}

/** Llama a Gemini respetando el margen entre llamadas compartido por todo el proceso. */
async function llamarGemini(model, prompt) {
	if (seHaLlamadoAGeminiEnEsteProceso) {
		await esperar(RATE_LIMIT_DELAY_MS);
	}
	seHaLlamadoAGeminiEnEsteProceso = true;

	const resultado = await model.generateContent(prompt);
	return resultado.response.text();
}

async function traducirLote(model, textos, idiomaInfo) {
	let ultimoError;

	for (let intento = 0; intento <= REINTENTOS_MAXIMOS; intento++) {
		try {
			const texto = await llamarGemini(model, construirPrompt(textos, idiomaInfo));
			const traducidas = limpiarJsonModelo(texto);

			if (!Array.isArray(traducidas) || traducidas.length !== textos.length) {
				throw new Error('Traducción con formato inesperado (longitud no coincide)');
			}

			const indiceInvalido = traducidas.findIndex((valor) => typeof valor !== 'string');
			if (indiceInvalido !== -1) {
				throw new Error(`Traducción con formato inesperado (elemento ${indiceInvalido} no es un string: ${JSON.stringify(traducidas[indiceInvalido])})`);
			}

			return traducidas;
		} catch (error) {
			const status = extraerStatusHttp(error);
			const retryDelayMs = extraerRetryDelayMs(error);

			if (esCuotaDiariaAgotada(status, retryDelayMs)) {
				throw new CuotaAgotadaError(error.message ?? String(error));
			}

			ultimoError = error;
			if (intento === REINTENTOS_MAXIMOS) break;
			await esperar(Math.min(retryDelayMs ?? 1000 * 2 ** intento, 5000));
		}
	}

	throw ultimoError;
}

async function traducirPagina(model, lang, idiomaInfo, page, cachePage) {
	const esSource = leerJson(rutaOrigenEs(page));
	if (!esSource) return { cambios: false, cachePage };

	// "tipo" es un discriminador interno de PoliticaBloques.astro ('parrafo' | 'lista' | 'tabla'),
	// no texto de usuario: traducirlo rompe el matching en el componente (ver bug de nl con
	// "paragraaf"/"tabel"). Se deja tal cual en destino vía structuredClone, sin pasar por Gemini.
	const hojas = recogerHojas(esSource).filter((hoja) => hoja.path[hoja.path.length - 1] !== 'tipo');
	const nuevaCachePage = {};
	const pendientes = [];

	for (const hoja of hojas) {
		const clave = hoja.path.join('/');
		const hash = sha256(hoja.value);
		const cacheada = cachePage[clave];

		if (cacheada && cacheada.hash === hash) {
			nuevaCachePage[clave] = cacheada;
			hoja.traducido = cacheada.value;
		} else {
			pendientes.push({ ...hoja, clave, hash });
		}
	}

	if (pendientes.length > 0) {
		const lotes = dividirEnLotes(pendientes, LOTE_MAXIMO);
		for (const lote of lotes) {
			const traducciones = await traducirLote(model, lote.map((h) => h.value), idiomaInfo);
			lote.forEach((hoja, i) => {
				hoja.traducido = traducciones[i];
				nuevaCachePage[hoja.clave] = { hash: hoja.hash, value: traducciones[i] };
			});
		}
	}

	const destino = structuredClone(esSource);
	for (const hoja of hojas) fijarEnRuta(destino, hoja.path, hoja.traducido);

	escribirJson(rutaDestino(lang, page), destino);

	return { cambios: pendientes.length > 0, cachePage: nuevaCachePage };
}

async function traducirLocale(model, idiomaInfo) {
	const lang = idiomaInfo.codigo;
	const cache = leerJson(rutaCache(lang)) ?? {};
	let huboCambios = false;

	for (const page of PAGES) {
		try {
			const resultado = await traducirPagina(model, lang, idiomaInfo, page, cache[page] ?? {});
			cache[page] = resultado.cachePage;
			if (resultado.cambios) huboCambios = true;
		} catch (error) {
			if (error instanceof CuotaAgotadaError) {
				// Se guarda ya lo traducido de este idioma en lo que va de ejecución (las páginas
				// anteriores de este mismo idioma) para no repetir esas llamadas la próxima vez.
				escribirJson(rutaCache(lang), cache);
				throw error;
			}
			console.error(`[${lang}] No se pudo traducir "${page}":`, error.message ?? error);
		}
	}

	escribirJson(rutaCache(lang), cache);
	console.log(`[${lang}] listo${huboCambios ? ' (con cambios)' : ' (sin cambios, todo cacheado)'}`);
}

async function main() {
	const apiKey = process.env.GEMINI_API_KEY;
	if (!apiKey) {
		console.error('Falta GEMINI_API_KEY. Uso: GEMINI_API_KEY=... npm run translate');
		process.exit(1);
	}

	const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: MODEL_NAME });

	console.log(`Traduciendo ${NEW_LOCALES.length} idiomas × ${PAGES.length} páginas (modelo: ${MODEL_NAME}, secuencial)...`);

	// Secuencial a propósito: el límite de peticiones/minuto de Gemini es compartido por todo el
	// proceso, así que procesar idiomas en paralelo no lo evitaría, solo arriesgaría carreras
	// sobre el margen entre llamadas.
	for (const idioma of IDIOMAS) {
		try {
			await traducirLocale(model, idioma);
		} catch (error) {
			if (error instanceof CuotaAgotadaError) {
				console.error(
					`\nCuota diaria de Gemini agotada en "${idioma.codigo}". Parando aquí en vez de reintentar en vano ` +
						`el resto de idiomas: ${error.message}\n` +
						'Lo ya traducido en esta ejecución queda guardado (caché por hash), así que re-ejecutar ' +
						'`npm run translate` más tarde (o mañana, cuando resetee la cuota) retoma justo donde se quedó.',
				);
				process.exit(1);
			}
			throw error;
		}
	}

	console.log('Hecho.');
}

main();
