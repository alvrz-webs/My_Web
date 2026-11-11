-- Registro de consentimientos (art. 7.1 RGPD). Aplicar una vez en la base D1 de producción:
--   npx wrangler d1 execute web-mario-analitica --remote --file=db/migracion-2026-11-consentimientos.sql
-- y en la local para probar con `npm run panel:dev`:
--   npx wrangler d1 execute web-mario-analitica --local --file=db/migracion-2026-11-consentimientos.sql
--
-- Sin IP ni datos identificativos directos: la fila se enlaza con la persona por el identificador
-- seudónimo de su cookie `consentimiento_cookies` y, en el formulario, por la referencia de su email.

CREATE TABLE IF NOT EXISTS consentimientos (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	consentimiento_id TEXT NOT NULL,   -- seudónimo (UUID) guardado en la cookie consentimiento_cookies
	referencia TEXT,                   -- código MA-XXXXXX que viaja en el email del formulario de contacto
	origen TEXT NOT NULL,              -- banner | configuracion | politica_cookies | formulario_contacto
	accion TEXT NOT NULL,              -- aceptar | rechazar | retirar | aceptar_terminos
	cookies_analitica INTEGER,         -- 1 aceptadas, 0 rechazadas, NULL si no aplica
	terminos INTEGER,                  -- 1 aceptados (formulario), NULL si no aplica
	version_terminos TEXT,             -- fecha de la versión vigente de cada documento (src/data/legal.js)
	version_privacidad TEXT,
	version_cookies TEXT,
	pagina TEXT,                       -- ruta desde la que se hizo
	idioma TEXT,
	agente TEXT,                       -- navegador (User-Agent, recortado)
	pais TEXT,                         -- país aproximado que da Cloudflare
	creado_en TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))  -- hora del servidor, UTC
);
CREATE INDEX IF NOT EXISTS idx_consentimientos_id ON consentimientos(consentimiento_id);
CREATE INDEX IF NOT EXISTS idx_consentimientos_referencia ON consentimientos(referencia);
CREATE INDEX IF NOT EXISTS idx_consentimientos_creado ON consentimientos(creado_en);
CREATE INDEX IF NOT EXISTS idx_eventos_creado ON eventos(creado_en);
