/**
 * Datos del titular (art. 10 LSSI-CE) y versión vigente de cada documento legal.
 *
 * - Los textos legales (src/i18n/<lang>/terminos.json, politica-*.json) usan marcadores {nombre},
 *   {nif}, {domicilio}, {email} y {telefono}, que se rellenan con estos datos al compilar.
 *   Una línea con un marcador vacío no se pinta (por eso el NIF no aparece mientras esté vacío).
 * - La versión (fecha) viaja en cada registro de consentimiento: así se sabe qué texto exacto
 *   aceptó cada persona. Si cambias un documento de forma relevante, cambia aquí su fecha; si es
 *   el de cookies, el banner vuelve a preguntar a todo el mundo.
 */

export const TITULAR = {
	nombre: 'Mario Álvarez Martínez',
	// La LSSI-CE (art. 10.1) obliga a mostrar el NIF si se ofrecen servicios desde la web.
	nif: '49230699G',
	domicilio: 'Benidorm (Alicante), España',
	email: 'malvmar5@hotmail.com',
	telefono: '+34 656 867 231',
	web: 'https://marioalvarez.me',
};

export const VERSIONES = {
	terminos: '2026-11-10',
	privacidad: '2026-11-10',
	cookies: '2026-11-10',
	reembolso: '2026-11-10',
};
