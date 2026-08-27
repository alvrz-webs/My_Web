const GITHUB_USER = 'Marioam200';

/**
 * @typedef {Object} Repo
 * @property {number} id
 * @property {string} name
 * @property {string|null} description
 * @property {string} html_url
 * @property {string|null} language
 * @property {string} updated_at
 * @property {boolean} fork
 */

// Cache a nivel de módulo con TTL: en `astro dev` esta función se llama en cada render de una
// página con proyectos, y sin caché eso agota enseguida el límite de la API de GitHub sin
// autenticar (60 peticiones/hora). Se cachea también el resultado vacío de un fallo (403/429),
// para no volver a golpear la API en cada render mientras el límite sigue activo.
const CACHE_TTL_MS = 5 * 60 * 1000;
let cache = null;
let cacheExpira = 0;

/**
 * Obtiene los repositorios públicos de Mario en GitHub, ya filtrados y ordenados por fecha de
 * actualización descendente. Sin autenticar por defecto (60 peticiones/hora es de sobra para el
 * tráfico real del sitio); definir GITHUB_API_TOKEN en local sube ese límite a 5000/hora, útil
 * mientras se itera con `astro dev`.
 * @returns {Promise<Repo[]>}
 */
export async function obtenerRepos() {
	if (cache && Date.now() < cacheExpira) return cache;

	const headers = { Accept: 'application/vnd.github+json' };
	if (process.env.GITHUB_API_TOKEN) {
		headers.Authorization = `Bearer ${process.env.GITHUB_API_TOKEN}`;
	}

	let repos = [];
	try {
		const response = await fetch(`https://api.github.com/users/${GITHUB_USER}/repos?sort=updated&per_page=100`, { headers });

		if (response.ok) {
			const data = await response.json();
			repos = data
				.filter((repo) => repo.name !== GITHUB_USER)
				.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
		} else {
			console.error(`GitHub API respondió con estado ${response.status}`);
		}
	} catch (error) {
		console.error('Error al obtener los repositorios de GitHub:', error);
	}

	cache = repos;
	cacheExpira = Date.now() + CACHE_TTL_MS;
	return repos;
}
