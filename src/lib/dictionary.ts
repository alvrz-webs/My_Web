import type { Locale } from './i18n';
import { DEFAULT_LOCALE } from './i18n';

export type Page =
	| 'common'
	| 'inicio'
	| 'sobre-mi'
	| 'experiencia'
	| 'proyectos'
	| 'contacto'
	| 'politica-cookies'
	| 'politica-privacidad'
	| 'terminos'
	| 'politica-reembolso'
	| '404';

// inicio/sobre-mi/experiencia en es/en siguen viviendo en src/data/ (y src/data/en/) porque el
// panel privado de Mario los lee y escribe ahí directamente vía la API de GitHub (ver
// functions/api/guardar.js y chat.js, que hardcodean la ruta "src/data/<archivo>"). Moverlos
// rompería ese flujo, así que solo los 62 idiomas nuevos de esas 3 páginas se generan en
// src/i18n/<lang>/. El resto de páginas (sin dependencia del panel) viven enteramente en
// src/i18n/<lang>/ para los 64 locales.
const PANEL_PAGES = new Set(['inicio', 'sobre-mi', 'experiencia']);

const modulosI18n = import.meta.glob<{ default: Record<string, unknown> }>('../i18n/*/*.json', { eager: true });
const modulosDataEs = import.meta.glob<{ default: Record<string, unknown> }>('../data/*.json', { eager: true });
const modulosDataEn = import.meta.glob<{ default: Record<string, unknown> }>('../data/en/*.json', { eager: true });

function leer(lang: string, page: Page): Record<string, unknown> | undefined {
	if (PANEL_PAGES.has(page)) {
		if (lang === 'es') return modulosDataEs[`../data/${page}.json`]?.default;
		if (lang === 'en') return modulosDataEn[`../data/en/${page}.json`]?.default;
	}
	return modulosI18n[`../i18n/${lang}/${page}.json`]?.default;
}

type Dict = Record<string, unknown>;

const esObjeto = (v: unknown): v is Dict => typeof v === 'object' && v !== null && !Array.isArray(v);

// Mezcla clave a clave: lo que falte en `encima` se toma de `base`. Así, cuando se añade una clave
// nueva en es/en y aún no se ha ejecutado `npm run translate`, los demás idiomas no se rompen.
// Las listas con la misma longitud que la de base se mezclan elemento a elemento, de modo que un
// elemento traducido a medias (por ejemplo, un resultado del palmarés sin su texto) también se
// completa con la base en vez de quedar vacío.
function mezclarValor(base: unknown, encima: unknown): unknown {
	if (encima === undefined || encima === null) return base;
	if (esObjeto(encima) && esObjeto(base)) return mezclar(base, encima);
	if (Array.isArray(encima) && Array.isArray(base) && encima.length === base.length) {
		return encima.map((valor, i) => mezclarValor(base[i], valor));
	}
	return encima;
}

function mezclar(base: Dict, encima: Dict): Dict {
	const resultado: Dict = { ...base };
	for (const [clave, valor] of Object.entries(encima)) {
		resultado[clave] = mezclarValor(base[clave], valor);
	}
	return resultado;
}

/**
 * Diccionario de una página para un locale. Las claves que falten se rellenan con el inglés
 * (o con el español, si tampoco hay inglés), para que una clave nueva sin traducir nunca deje
 * un hueco en la página.
 */
export function getDict(lang: Locale, page: Page): Dict {
	const es = leer(DEFAULT_LOCALE, page) ?? {};
	if (lang === DEFAULT_LOCALE) return es;
	const en = lang === 'en' ? {} : (leer('en' as Locale, page) ?? {});
	return mezclar(mezclar(es, en), leer(lang, page) ?? {});
}

/** El diccionario de un idioma tal cual está en su archivo, sin rellenar con es/en (o undefined). */
export function getDictCrudo(lang: Locale, page: Page): Dict | undefined {
	return leer(lang, page);
}
