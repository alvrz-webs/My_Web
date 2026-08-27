import { IDIOMAS } from '../data/idiomas.js';

// Lista maestra de locales servidos como páginas estáticas reales. Debe mantenerse en sync con
// los códigos de src/data/idiomas.js (que además aporta el nombre nativo para el selector). Se
// duplica aquí como tupla literal para conservar el tipo `Locale` como unión de strings.
export const LOCALES = [
	'es',
	'en',
	'fr', 'de', 'it', 'pt', 'ca', 'eu', 'gl', 'nl', 'sv', 'no', 'da', 'fi', 'is',
	'pl', 'cs', 'sk', 'hu', 'ro', 'bg', 'el', 'ru', 'uk', 'hr', 'sr', 'sl', 'lt', 'lv', 'et',
	'tr', 'ar', 'he', 'fa', 'ur', 'hi', 'bn', 'pa', 'gu', 'mr', 'ta', 'te', 'kn', 'ml', 'ne',
	'si', 'th', 'vi', 'id', 'ms', 'tl', 'my', 'km', 'lo', 'zh', 'ja', 'ko', 'sw', 'am', 'af',
	'az', 'ka', 'hy', 'ga',
] as const;

export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'es';

/** Los 62 locales servidos como rutas dinámicas nuevas (todo LOCALES salvo es/en, que ya tienen sus .astro propios). */
export const NEW_LOCALES = LOCALES.filter((l): l is Exclude<Locale, 'es' | 'en'> => l !== 'es' && l !== 'en');

/** Locales que se renderizan de derecha a izquierda. */
export const RTL_LOCALES: readonly Locale[] = ['ar', 'he', 'fa', 'ur'];
export const isRtl = (lang: Locale): boolean => (RTL_LOCALES as readonly string[]).includes(lang);

/**
 * Rutas cuyo slug no sigue el patrón simétrico /foo <-> /en/foo (páginas legales con un slug
 * distinto y más natural en cada idioma). Formato: [ruta en es, ruta en en]. Solo EN tiene slugs
 * localizados a mano; el resto de idiomas usan el slug español bajo su prefijo.
 */
const RUTAS_ASIMETRICAS_EN: [es: string, en: string][] = [
	['/politica-de-privacidad', '/en/privacy-policy'],
	['/politica-de-cookies', '/en/cookie-policy'],
];

/** Antepone /{lang} a una ruta en español cuando el idioma no es el por defecto. */
export function localizedPath(path: string, lang: Locale): string {
	if (lang === DEFAULT_LOCALE) return path;
	if (lang === 'en') {
		const excepcion = RUTAS_ASIMETRICAS_EN.find(([es]) => es === path);
		if (excepcion) return excepcion[1];
	}
	return path === '/' ? `/${lang}` : `/${lang}${path}`;
}

/** Dada una ruta ya localizada, devuelve su equivalente en español (sin prefijo de idioma). */
export function basePath(pathname: string): string {
	const clean = pathname.replace(/\/$/, '') || '/';

	const porRutaEn = RUTAS_ASIMETRICAS_EN.find(([, en]) => en === clean);
	if (porRutaEn) return porRutaEn[0];

	if (clean === '/en' || clean.startsWith('/en/')) {
		const sinPrefijo = clean.slice(3);
		return sinPrefijo || '/';
	}

	for (const lang of LOCALES) {
		if (lang === 'es' || lang === 'en') continue;
		const prefijo = `/${lang}`;
		if (clean === prefijo || clean.startsWith(`${prefijo}/`)) {
			const sinPrefijo = clean.slice(prefijo.length);
			return sinPrefijo || '/';
		}
	}

	return clean;
}

/** Dada la ruta actual, devuelve la misma ruta en el idioma indicado. */
export function pathForLocale(pathname: string, lang: Locale): string {
	return localizedPath(basePath(pathname), lang);
}

/** Idioma actual a partir de la ruta. */
export function localeFromPath(pathname: string): Locale {
	const clean = pathname.replace(/\/$/, '') || '/';
	if (clean === '/en' || clean.startsWith('/en/')) return 'en';

	for (const lang of LOCALES) {
		if (lang === 'es' || lang === 'en') continue;
		const prefijo = `/${lang}`;
		if (clean === prefijo || clean.startsWith(`${prefijo}/`)) return lang;
	}

	return 'es';
}

export { IDIOMAS };
