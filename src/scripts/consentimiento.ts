/**
 * Consentimiento: una sola fuente para el banner de cookies, la página de cookies y el formulario
 * de contacto.
 *
 * La cookie técnica `consentimiento_cookies` guarda "decisión:identificador:versión", por ejemplo
 * "aceptado:3f2c…:2026-11-10". El identificador es seudónimo (aleatorio, no dice quién eres) y es
 * el mismo que se guarda en el registro de /api/consentimiento: con él se puede demostrar cuándo y
 * cómo se aceptó o rechazó (art. 7.1 RGPD) sin guardar la IP ni ningún dato directo.
 */

export const COOKIE_CONSENTIMIENTO = 'consentimiento_cookies';
export const COOKIE_VISITANTE = 'visitante_id';
const DOCE_MESES_SEGUNDOS = 60 * 60 * 24 * 365;

export type Decision = 'aceptado' | 'rechazado';
export type Origen = 'banner' | 'configuracion' | 'politica_cookies' | 'formulario_contacto';
export type Accion = 'aceptar' | 'rechazar' | 'retirar' | 'aceptar_terminos';

type Versiones = { terminos: string; privacidad: string; cookies: string; reembolso: string };

export function leerCookie(nombre: string): string | null {
	const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${nombre}=([^;]*)`));
	return match ? decodeURIComponent(match[1]) : null;
}

export function escribirCookie(nombre: string, valor: string) {
	document.cookie = `${nombre}=${encodeURIComponent(valor)}; Max-Age=${DOCE_MESES_SEGUNDOS}; Path=/; SameSite=Lax; Secure`;
}

export function borrarCookie(nombre: string) {
	document.cookie = `${nombre}=; Max-Age=0; Path=/; SameSite=Lax; Secure`;
}

/** Versiones vigentes de los documentos (las pone el Layout en <html data-versiones>). */
export function versiones(): Versiones {
	try {
		return JSON.parse(document.documentElement.dataset.versiones ?? '{}');
	} catch {
		return { terminos: '', privacidad: '', cookies: '', reembolso: '' };
	}
}

/** Decisión actual. Acepta el formato antiguo ("aceptado" a secas) de antes del registro. */
export function leerConsentimiento(): { decision: Decision; id: string | null; version: string | null } | null {
	const valor = leerCookie(COOKIE_CONSENTIMIENTO);
	if (!valor) return null;
	const [decision, id, version] = valor.split(':');
	if (decision !== 'aceptado' && decision !== 'rechazado') return null;
	return { decision, id: id || null, version: version || null };
}

function nuevoId(): string {
	if (crypto.randomUUID) return crypto.randomUUID();
	const b = crypto.getRandomValues(new Uint8Array(16));
	b[6] = (b[6] & 0x0f) | 0x40;
	b[8] = (b[8] & 0x3f) | 0x80;
	const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
	return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** El identificador seudónimo de este navegador (lo crea si aún no hay ninguno). */
export function idConsentimiento(): string {
	const actual = leerConsentimiento()?.id;
	if (actual) return actual;
	// Aún sin decisión de cookies (p. ej. alguien que solo acepta los términos del formulario):
	// un identificador provisional para esta pestaña, que pasará a la cookie si luego decide
	try {
		const provisional = sessionStorage.getItem(CLAVE_PROVISIONAL);
		if (provisional) return provisional;
	} catch {}
	const id = nuevoId();
	try {
		sessionStorage.setItem(CLAVE_PROVISIONAL, id);
	} catch {}
	return id;
}

const CLAVE_PROVISIONAL = 'consentimiento_id_provisional';

/** Código corto que viaja en el email del formulario y enlaza ese email con su registro. */
export function nuevaReferencia(): string {
	const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	const b = crypto.getRandomValues(new Uint8Array(6));
	return 'MA-' + Array.from(b, (x) => letras[x % letras.length]).join('');
}

/** Envía un registro a /api/consentimiento. Usa sendBeacon para que llegue aunque se cambie de página. */
export function registrar(datos: {
	accion: Accion;
	origen: Origen;
	cookiesAnalitica?: boolean | null;
	terminos?: boolean | null;
	referencia?: string | null;
}) {
	const v = versiones();
	const cuerpo = JSON.stringify({
		consentimientoId: idConsentimiento(),
		accion: datos.accion,
		origen: datos.origen,
		cookiesAnalitica: datos.cookiesAnalitica ?? null,
		terminos: datos.terminos ?? null,
		referencia: datos.referencia ?? null,
		versionTerminos: v.terminos,
		versionPrivacidad: v.privacidad,
		versionCookies: v.cookies,
		pagina: location.pathname,
		idioma: document.documentElement.lang,
	});
	try {
		if (navigator.sendBeacon?.('/api/consentimiento', new Blob([cuerpo], { type: 'text/plain' }))) return;
	} catch {}
	fetch('/api/consentimiento', { method: 'POST', body: cuerpo, keepalive: true }).catch(() => {});
}

/**
 * Guarda una decisión sobre las cookies de analítica: cookie técnica + registro trazable.
 * Rechazar después de haber aceptado cuenta como retirada del consentimiento.
 */
export function guardarDecision(decision: Decision, origen: Origen) {
	const previo = leerConsentimiento();
	const id = idConsentimiento();
	escribirCookie(COOKIE_CONSENTIMIENTO, `${decision}:${id}:${versiones().cookies}`);

	const accion: Accion = decision === 'aceptado' ? 'aceptar' : previo?.decision === 'aceptado' ? 'retirar' : 'rechazar';
	registrar({ accion, origen, cookiesAnalitica: decision === 'aceptado' });

	if (decision === 'aceptado') {
		if (!leerCookie(COOKIE_VISITANTE)) escribirCookie(COOKIE_VISITANTE, nuevoId());
		window.dispatchEvent(new CustomEvent('cookies-aceptadas'));
	} else {
		borrarCookie(COOKIE_VISITANTE);
		window.dispatchEvent(new CustomEvent('cookies-rechazadas'));
	}
	window.dispatchEvent(new CustomEvent('consentimiento-cambiado', { detail: { decision } }));
}

/** ¿Hay que (volver a) preguntar? Sí si no hay decisión o si la política de cookies ha cambiado. */
export function hayQuePreguntar(): boolean {
	const actual = leerConsentimiento();
	if (!actual) return true;
	const vigente = versiones().cookies;
	return Boolean(vigente && actual.version && actual.version !== vigente);
}
