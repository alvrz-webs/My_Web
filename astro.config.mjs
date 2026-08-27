// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { LOCALES, DEFAULT_LOCALE } from './src/lib/i18n.ts';

// https://astro.build/config
export default defineConfig({
	site: 'https://marioalvarez.me',
	integrations: [
		sitemap({
			filter: (page) => !page.includes('/panel'),
			i18n: {
				defaultLocale: DEFAULT_LOCALE,
				locales: Object.fromEntries(LOCALES.map((locale) => [locale, locale])),
			},
		}),
	],
});
