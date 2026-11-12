// Crea un usuario del panel en D1, o le cambia la contraseña si ese email ya existe, sin que
// el email, el hash ni la sal pasen nunca por un fichero del repo (sustituye al antiguo
// db/seed-usuario.sql).
//
//   npm run panel:usuario -- --local    → D1 local que usa `npm run panel:dev`
//   npm run panel:usuario -- --remote   → D1 de producción
//
// Lee PANEL_ADMIN_EMAIL (y opcionalmente PANEL_ADMIN_NOMBRE) de .env o del entorno. La
// contraseña se pide por teclado, oculta y dos veces; solo si no hay terminal interactiva se
// toma de PANEL_ADMIN_PASSWORD. El hash se calcula con la misma función que usa el login
// (functions/api/_auth.js), así que los parámetros de PBKDF2 nunca se desincronizan.

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashPassword } from '../functions/api/_auth.js';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const WRANGLER = join(RAIZ, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const BASE_DE_DATOS = 'web-mario-analitica'; // database_name de wrangler.toml

// Mismas reglas que functions/api/panel/usuarios.js
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_LONGITUD_MINIMA = 10;

function salir(mensaje) {
	console.error(mensaje);
	process.exit(1);
}

function pedirOculto(pregunta) {
	return new Promise((resolve) => {
		const { stdin, stdout } = process;
		let texto = '';
		const terminar = () => {
			stdin.off('data', alTeclear);
			stdin.setRawMode(false);
			stdin.pause();
			stdout.write('\n');
		};
		const alTeclear = (trozo) => {
			for (const c of trozo) {
				if (c === '\r' || c === '\n') {
					terminar();
					resolve(texto);
					return;
				}
				if (c === '\u0003') {
					terminar();
					process.exit(130);
				}
				if (c === '\b' || c === '\u007f') texto = texto.slice(0, -1);
				else texto += c;
			}
		};
		stdout.write(pregunta);
		stdin.setEncoding('utf8');
		stdin.setRawMode(true);
		stdin.resume();
		stdin.on('data', alTeclear);
	});
}

async function obtenerPassword() {
	if (!process.stdin.isTTY) {
		const desdeEntorno = process.env.PANEL_ADMIN_PASSWORD;
		if (!desdeEntorno) salir('Sin terminal interactiva: define PANEL_ADMIN_PASSWORD para esta ejecución.');
		return desdeEntorno;
	}
	const password = await pedirOculto('Contraseña nueva: ');
	const repetida = await pedirOculto('Repítela: ');
	if (password !== repetida) salir('Las contraseñas no coinciden.');
	return password;
}

const sqlTexto = (valor) => `'${valor.replaceAll("'", "''")}'`;

const modo = ['--local', '--remote'].filter((flag) => process.argv.includes(flag));
if (modo.length !== 1) salir('Indica exactamente uno: --local o --remote');

try {
	process.loadEnvFile(join(RAIZ, '.env'));
} catch {
	// Sin .env: se usan solo las variables que ya haya en el entorno.
}

const email = process.env.PANEL_ADMIN_EMAIL?.trim();
const nombre = process.env.PANEL_ADMIN_NOMBRE?.trim() || 'Admin';
if (!email || !EMAIL_REGEX.test(email)) salir('Falta PANEL_ADMIN_EMAIL en .env (o no es un email válido).');

const password = await obtenerPassword();
if (password.length < PASSWORD_LONGITUD_MINIMA) {
	salir(`La contraseña debe tener al menos ${PASSWORD_LONGITUD_MINIMA} caracteres.`);
}

const { hash, salt } = await hashPassword(password);

// Si el email ya existe solo se cambian hash y sal: rotar la contraseña no renombra a nadie.
const sql =
	'INSERT INTO usuarios_panel (nombre, email, password_hash, password_salt) ' +
	`VALUES (${sqlTexto(nombre)}, ${sqlTexto(email)}, '${hash}', '${salt}') ` +
	'ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash, password_salt = excluded.password_salt';

// Se ejecuta con --command (no con --file) para no escribir el hash en ningún fichero, ni
// siquiera temporal. Sin shell, así que las comillas del SQL llegan intactas.
const resultado = spawnSync(process.execPath, [WRANGLER, 'd1', 'execute', BASE_DE_DATOS, modo[0], '--command', sql], {
	cwd: RAIZ,
	stdio: 'inherit',
});

if (resultado.status !== 0) salir('wrangler d1 execute falló (¿has hecho `npx wrangler login`?).');
console.log(`Listo: ${email} creado, o con la contraseña cambiada, en D1 (${modo[0].slice(2)}).`);
