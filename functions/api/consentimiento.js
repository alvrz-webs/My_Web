import { json } from './_lib.js';

/**
 * Registro de consentimientos (art. 7.1 RGPD: el responsable debe poder demostrar el consentimiento).
 *
 * Cada fila dice cuándo (hora del servidor, UTC) y cómo (origen, página, idioma, navegador) se
 * aceptó, rechazó o retiró algo, y qué versión exacta de cada documento estaba vigente. Se enlaza
 * con la persona solo a través del identificador seudónimo de su cookie `consentimiento_cookies`
 * y, en el formulario de contacto, del código de referencia que viaja en su email.
 *
 * Minimización: no se guarda la IP ni ningún dato identificativo directo. Conservación: 3 años
 * (plazo máximo de prescripción de las infracciones de la LOPDGDD); lo antiguo se borra solo.
 */

const ORIGENES = new Set(['banner', 'configuracion', 'politica_cookies', 'formulario_contacto']);
const ACCIONES = new Set(['aceptar', 'rechazar', 'retirar', 'aceptar_terminos']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REFERENCIA = /^MA-[A-Z0-9]{6}$/;
const VERSION = /^\d{4}-\d{2}-\d{2}$/;
const IDIOMA = /^[a-z]{2,3}$/;
const PROBABILIDAD_LIMPIEZA = 0.02;

const versionValida = (v) => v === '' || v === null || v === undefined || (typeof v === 'string' && VERSION.test(v));
const boolONulo = (v) => v === null || v === undefined || typeof v === 'boolean';
const aEntero = (v) => (typeof v === 'boolean' ? (v ? 1 : 0) : null);

function esValido(b) {
	return (
		b &&
		typeof b === 'object' &&
		typeof b.consentimientoId === 'string' &&
		UUID.test(b.consentimientoId) &&
		ACCIONES.has(b.accion) &&
		ORIGENES.has(b.origen) &&
		boolONulo(b.cookiesAnalitica) &&
		boolONulo(b.terminos) &&
		(b.referencia === null || b.referencia === undefined || (typeof b.referencia === 'string' && REFERENCIA.test(b.referencia))) &&
		versionValida(b.versionTerminos) &&
		versionValida(b.versionPrivacidad) &&
		versionValida(b.versionCookies) &&
		typeof b.pagina === 'string' &&
		b.pagina.startsWith('/') &&
		typeof b.idioma === 'string' &&
		IDIOMA.test(b.idioma)
	);
}

export async function onRequestPost({ request, env, waitUntil }) {
	if (!env.DB) {
		return json({ ok: false, error: 'Falta el binding DB' }, 500);
	}

	// Solo desde esta misma web
	const origen = request.headers.get('Origin');
	if (origen) {
		try {
			if (new URL(origen).host !== new URL(request.url).host) return json({ ok: false, error: 'Origen no permitido' }, 403);
		} catch {
			return json({ ok: false, error: 'Origen no válido' }, 403);
		}
	}

	let body;
	try {
		// sendBeacon envía text/plain: se lee como texto y se interpreta como JSON
		body = JSON.parse(await request.text());
	} catch {
		return json({ ok: false, error: 'Body no es JSON válido' }, 400);
	}

	if (!esValido(body)) {
		return json({ ok: false, error: 'Formato de body inesperado' }, 400);
	}

	const agente = (request.headers.get('User-Agent') ?? '').slice(0, 300) || null;
	const pais = request.cf?.country ?? null;

	try {
		await env.DB.prepare(
			`INSERT INTO consentimientos
				(consentimiento_id, referencia, origen, accion, cookies_analitica, terminos,
				 version_terminos, version_privacidad, version_cookies, pagina, idioma, agente, pais)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		)
			.bind(
				body.consentimientoId,
				body.referencia ?? null,
				body.origen,
				body.accion,
				aEntero(body.cookiesAnalitica),
				aEntero(body.terminos),
				body.versionTerminos || null,
				body.versionPrivacidad || null,
				body.versionCookies || null,
				body.pagina.slice(0, 300),
				body.idioma,
				agente,
				pais,
			)
			.run();
	} catch (error) {
		console.error('No se pudo guardar el registro de consentimiento:', error);
		return json({ ok: false, error: 'No se pudo guardar en la base de datos' }, 500);
	}

	// Conservación: lo que tenga más de 3 años se borra (de vez en cuando, sin frenar la respuesta)
	if (Math.random() < PROBABILIDAD_LIMPIEZA) {
		waitUntil(
			env.DB.prepare(`DELETE FROM consentimientos WHERE creado_en < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-3 years')`)
				.run()
				.catch((error) => console.error('No se pudieron borrar consentimientos antiguos:', error)),
		);
	}

	return new Response(null, { status: 204 });
}

export async function onRequest() {
	return json({ ok: false, error: 'Solo POST' }, 405);
}
