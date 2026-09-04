import { IDIOMAS } from '../data/idiomas.js';
import { slugParaIdioma, seccionCanonicaDesdeSlug } from '../data/slugs.js';

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
 * Antepone /{lang} a una ruta canónica en español, traduciendo también el slug de la sección al
 * idioma correspondiente (ver src/data/slugs.js) — no solo el prefijo de idioma.
 */
export function localizedPath(path: string, lang: Locale): string {
	if (lang === DEFAULT_LOCALE) return path;
	if (path === '/') return `/${lang}`;

	const [, seccion, ...resto] = path.split('/');
	const slugTraducido = slugParaIdioma(seccion, lang);
	const cola = resto.length ? `/${resto.join('/')}` : '';
	return `/${lang}/${slugTraducido}${cola}`;
}

/** Dada una ruta ya localizada, devuelve su equivalente canónico en español (sin prefijo de idioma). */
export function basePath(pathname: string): string {
	const clean = pathname.replace(/\/$/, '') || '/';

	for (const lang of LOCALES) {
		if (lang === 'es') continue;
		const prefijo = `/${lang}`;
		if (clean === prefijo) return '/';
		if (clean.startsWith(`${prefijo}/`)) {
			const resto = clean.slice(prefijo.length + 1);
			const [seccion, ...cola] = resto.split('/');
			const canonica = seccionCanonicaDesdeSlug(lang, seccion) ?? seccion;
			return `/${canonica}${cola.length ? `/${cola.join('/')}` : ''}`;
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

	for (const lang of LOCALES) {
		if (lang === 'es') continue;
		const prefijo = `/${lang}`;
		if (clean === prefijo || clean.startsWith(`${prefijo}/`)) return lang;
	}

	return 'es';
}

export { IDIOMAS };
