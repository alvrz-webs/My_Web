CREATE TABLE IF NOT EXISTS eventos (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	visitante_id TEXT NOT NULL,
	tipo TEXT NOT NULL, -- 'vista_seccion' | 'vista_proyecto' | 'tiempo_atencion' | 'clic'
	seccion TEXT,
	proyecto TEXT,
	duracion_segundos INTEGER,
	idioma TEXT,
	dispositivo TEXT,
	pais TEXT,
	origen TEXT,
	creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_eventos_visitante ON eventos(visitante_id);

CREATE TABLE IF NOT EXISTS usuarios_panel (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	nombre TEXT NOT NULL,
	email TEXT NOT NULL UNIQUE,
	password_hash TEXT NOT NULL,
	password_salt TEXT NOT NULL,
	creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS logs_sistema (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	nivel TEXT NOT NULL, -- 'info' | 'error'
	contexto TEXT NOT NULL, -- 'login' | 'chat' | 'guardar'
	mensaje TEXT NOT NULL,
	creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_logs_creado ON logs_sistema(creado_en);

-- Caché de la capa de traducción client-side (ver functions/api/traducir.js): evita volver a
-- llamar a Gemini para la misma ruta + idioma + contenido exacto (hash_contenido detecta si el
-- contenido de la página cambió desde la última traducción cacheada).
CREATE TABLE IF NOT EXISTS traducciones_cache (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	ruta TEXT NOT NULL,
	idioma TEXT NOT NULL,
	hash_contenido TEXT NOT NULL,
	contenido_json TEXT NOT NULL,
	creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_traducciones_cache_clave ON traducciones_cache(ruta, idioma, hash_contenido);

-- Registro de consentimientos (art. 7.1 RGPD). Ver db/migracion-2026-11-consentimientos.sql
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
