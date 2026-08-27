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

/** Diccionario de una página para un locale, con fallback a ES si ese locale aún no está traducido. */
export function getDict(lang: Locale, page: Page): Record<string, unknown> {
	return leer(lang, page) ?? leer(DEFAULT_LOCALE, page) ?? {};
}
