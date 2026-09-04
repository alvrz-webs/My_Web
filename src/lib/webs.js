const GITHUB_ORG = 'alvrz-webs';
const TOPIC_WEBS = 'portfolio-web';
const TOPIC_EN_DESARROLLO = 'en-desarrollo';

// Cache a nivel de módulo con TTL: en `astro dev` esta función se llama en cada render de una
// página con proyectos, y sin caché eso agota enseguida el límite de la API de GitHub sin
// autenticar (60 peticiones/hora). Se cachea también el resultado vacío de un fallo (403/429),
// para no volver a golpear la API en cada render mientras el límite sigue activo.
const CACHE_TTL_MS = 5 * 60 * 1000;
let cache = null;
let cacheExpira = 0;

/**
 * @typedef {Object} RepoWeb
 * @property {string} name
 * @property {string|null} description
 * @property {string|null} homepage
 * @property {string} htmlUrl
 * @property {string} previewUrl
 * @property {string[]} stack
 * @property {boolean} enDesarrollo
 */

/**
 * Pide la lista de repos de la organización, opcionalmente autenticado. Devuelve null (en vez de
 * lanzar) si la respuesta no es ok, para que la llamada pueda decidir si reintentar sin token.
 */
async function pedirReposOrg(headers) {
	try {
		const response = await fetch(`https://api.github.com/orgs/${GITHUB_ORG}/repos?per_page=100`, { headers });
		if (response.ok) return await response.json();
		console.error(`GitHub API respondió con estado ${response.status} al listar repos de "${GITHUB_ORG}"`);
		return null;
	} catch (error) {
		console.error(`Error al obtener los repositorios de la organización "${GITHUB_ORG}":`, error);
		return null;
	}
}

/**
 * Obtiene los repos de la organización de GitHub que tengan el topic "portfolio-web" y los
 * transforma al formato que necesita la tarjeta de la pestaña "Webs" de Proyectos.
 * Sin autenticar por defecto: la organización "alvrz-webs" rechaza con 403 los fine-grained PAT
 * con vida útil superior a 366 días (política propia de la org), y con tan pocos repos el límite
 * de 60 peticiones/hora sin autenticar no supone ningún riesgo en build time. En local, definir
 * GITHUB_API_TOKEN (opcional, cualquier PAT de lectura vale) evita agotar ese límite mientras se
 * itera con `astro dev`, que llama a esta función en cada render. Si ese token (aquí o el que
 * haya configurado en el entorno de despliegue) resulta rechazado por la política de la org, se
 * reintenta automáticamente sin autenticar en vez de devolver la pestaña vacía.
 * @returns {Promise<RepoWeb[]>}
 */
export async function obtenerWebs() {
	if (cache && Date.now() < cacheExpira) return cache;

	let repos = null;

	if (process.env.GITHUB_API_TOKEN) {
		repos = await pedirReposOrg({
			Accept: 'application/vnd.github+json',
			Authorization: `Bearer ${process.env.GITHUB_API_TOKEN}`,
		});
		if (!repos) console.error('Reintentando sin autenticar tras el fallo con GITHUB_API_TOKEN...');
	}

	if (!repos) {
		repos = (await pedirReposOrg({ Accept: 'application/vnd.github+json' })) ?? [];
	}

	const resultado = repos
		.filter((repo) => Array.isArray(repo.topics) && repo.topics.includes(TOPIC_WEBS))
		.map((repo) => ({
			name: repo.name,
			description: repo.description,
			homepage: repo.homepage || null,
			htmlUrl: repo.html_url,
			previewUrl: `https://raw.githubusercontent.com/${GITHUB_ORG}/${repo.name}/${repo.default_branch}/preview.png`,
			stack: repo.topics.filter((topic) => topic !== TOPIC_WEBS && topic !== TOPIC_EN_DESARROLLO),
			enDesarrollo: repo.topics.includes(TOPIC_EN_DESARROLLO),
		}));

	cache = resultado;
	cacheExpira = Date.now() + CACHE_TTL_MS;
	return resultado;
}
