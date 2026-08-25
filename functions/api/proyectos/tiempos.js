import { json } from '../_lib.js';

// Agregado público y sin datos sensibles: se cachea un rato con la Cache API de Cloudflare
// para no golpear D1 en cada visita a /proyectos.
const TTL_SEGUNDOS = 300;

export async function onRequestGet({ request, env }) {
	if (!env.DB) {
		return json({ ok: false, error: 'Falta el binding DB' }, 500);
	}

	const cache = caches.default;
	const cacheKey = new Request(request.url, { method: 'GET' });

	const enCache = await cache.match(cacheKey);
	if (enCache) return enCache;

	let filas;
	try {
		const resultado = await env.DB.prepare(
			`SELECT proyecto, SUM(duracion_segundos) AS segundos_totales
			 FROM eventos
			 WHERE tipo = 'tiempo_atencion' AND proyecto IS NOT NULL
			 GROUP BY proyecto`,
		).all();
		filas = resultado.results;
	} catch (error) {
		console.error('No se pudieron calcular los tiempos de atención por proyecto:', error);
		return json({ ok: false, error: 'No se pudo consultar la base de datos' }, 500);
	}

	const tiempos = {};
	for (const fila of filas) {
		tiempos[fila.proyecto] = fila.segundos_totales ?? 0;
	}

	const response = new Response(JSON.stringify(tiempos), {
		status: 200,
		headers: {
			'Content-Type': 'application/json',
			'Cache-Control': `public, max-age=${TTL_SEGUNDOS}`,
		},
	});

	await cache.put(cacheKey, response.clone());
	return response;
}

export async function onRequest() {
	return json({ ok: false, error: 'Solo GET por ahora' }, 405);
}
