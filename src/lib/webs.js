const GITHUB_ORG = 'alvrz-webs';
const TOPIC_WEBS = 'portfolio-web';
const TOPIC_EN_DESARROLLO = 'en-desarrollo';

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
 * Obtiene los repos de la organización de GitHub que tengan el topic "portfolio-web" y los
 * transforma al formato que necesita la tarjeta de la pestaña "Webs" de Proyectos.
 * Usa GITHUB_TOKEN (opcional) para autenticar la petición y evitar el límite de 60 peticiones/hora
 * sin autenticar; si no está definida, la petición se hace igualmente sin autenticar.
 * @returns {Promise<RepoWeb[]>}
 */
export async function obtenerWebs() {
	const headers = { Accept: 'application/vnd.github+json' };
	if (process.env.GITHUB_TOKEN) {
		headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
	}

	let repos = [];
	try {
		const response = await fetch(`https://api.github.com/orgs/${GITHUB_ORG}/repos?per_page=100`, { headers });

		if (response.ok) {
			repos = await response.json();
		} else {
			console.error(`GitHub API respondió con estado ${response.status} al listar repos de "${GITHUB_ORG}"`);
		}
	} catch (error) {
		console.error(`Error al obtener los repositorios de la organización "${GITHUB_ORG}":`, error);
	}

	return repos
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
}
