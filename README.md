# Astro Starter Kit: Basics

```sh
npm create astro@latest -- --template basics
```

> 🧑‍🚀 **Seasoned astronaut?** Delete this file. Have fun!

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

```text
/
├── public/
│   └── favicon.svg
├── src
│   ├── assets
│   │   └── astro.svg
│   ├── components
│   │   └── Welcome.astro
│   ├── layouts
│   │   └── Layout.astro
│   └── pages
│       └── index.astro
└── package.json
```

To learn more about the folder structure of an Astro project, refer to [our guide on project structure](https://docs.astro.build/en/basics/project-structure/).

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |

## Probar las Cloudflare Pages Functions en local

`npm run dev` (`astro dev`) **no sirve `functions/`**: es solo el dev server de Astro (Node/Vite),
así que cualquier ruta `/api/*` responde 404 ahí. Para probar el panel, `/api/track`,
`/api/proyectos/tiempos` o cualquier otra Function en local hace falta:

```sh
npm run panel:dev   # astro build && wrangler pages dev dist
```

Eso hace un build estático y sirve `dist/` + `functions/` juntos con el runtime real de
Cloudflare Workers (bindings D1 incluidos). Si cambias código de página, hay que repetir el build
(o dejar `astro build --watch` en otra terminal); si solo cambias una Function, `wrangler pages
dev` la recoge sin rebuild.

Dos ficheros de entorno local, cada uno para un runtime distinto (ambos en `.gitignore`, cada uno
con su `.example` en el repo):

- **`.env`** — lo lee `astro dev`/`astro build` (proceso Node) vía `process.env`. Lo usan
  `src/lib/descripciones.js`, `src/lib/webs.js` y `src/lib/repos.js` (`GEMINI_API_KEY`,
  `GITHUB_API_TOKEN`). Ver `.env.example`.
- **`.dev.vars`** — lo lee `wrangler pages dev` (runtime de Workers) como si fueran bindings de
  `env`. Lo usan las Functions del panel (`GITHUB_TOKEN`, `GITHUB_REPO`, `SESSION_SECRET`,
  `GEMINI_API_KEY`). Ver `.dev.vars.example`.

## Variables de entorno y secrets (Cloudflare Pages, producción)

Además de `wrangler.toml` (binding D1 `DB` → base `web-mario-analitica`), estas variables tienen
que existir en el entorno de **Production** del proyecto de Pages (Dashboard → proyecto →
Settings → Environment variables, o por CLI) — `.env`/`.dev.vars` locales **no** se sincronizan
solos con producción:

| Variable          | Usada por                                                              | Notas                                                                 |
| ----------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `GEMINI_API_KEY`  | `functions/api/cv-pdf.js`, `src/lib/descripciones.js` (en build)       | Google Gemini (`@google/generative-ai`), modelo `gemini-flash-latest`. Cuota gratuita muy ajustada (ver aviso abajo) y **compartida** entre ambas funciones. |
| `GITHUB_TOKEN`    | `functions/api/guardar.js`, `cv-pdf.js`, `chat.js`, `functions/api/_lib.js` | Token con permisos de escritura sobre `GITHUB_REPO`.                  |
| `GITHUB_REPO`     | igual que arriba                                                       | Formato `owner/repo`.                                                 |
| `SESSION_SECRET`  | `functions/api/_auth.js`                                               | Firma HMAC de la cookie de sesión del panel.                          |
| `GITHUB_API_TOKEN`| `src/lib/descripciones.js`, `src/lib/webs.js`, `src/lib/repos.js` (en build) | Opcional, solo lectura. Sin ella estas llamadas van sin autenticar (60 peticiones/hora); con ella, 5000/hora. No hace falta en producción salvo que el build empiece a toparse con el límite. |

Darlas de alta como **secret** (cifrado, no visible después en el dashboard) en vez de variable de
entorno en texto plano:

```sh
npx wrangler pages secret put GEMINI_API_KEY --project-name marioalvarez-data
```

Nunca subas estos valores al repo (`.env` y `.dev.vars` ya están en `.gitignore`).

### Migración de `db/schema.sql`

Cualquier tabla nueva en `db/schema.sql` (usa `CREATE TABLE IF NOT EXISTS`, así que aplicarlo de
nuevo es seguro) hay que ejecutarla a mano contra la D1 real:

```sh
npx wrangler d1 execute web-mario-analitica --remote --file=db/schema.sql
```

### ⚠️ Cuota de Gemini

El modelo `gemini-flash-latest` tiene, en el nivel gratuito, un límite muy bajo de peticiones al
día (~15/min, y un tope diario bastante más estricto). Esa cuota la comparte **todo lo que use
`GEMINI_API_KEY`**:

- `src/lib/descripciones.js` — genera descripciones de proyectos en cada build/deploy para los
  repos con README nuevo o cambiado. Si se agota, no rompe el build: cae al texto de la caché
  existente o a un texto de reserva genérico.
- `functions/api/cv-pdf.js` — traducción del CV.
- `scripts/translate.mjs` (`npm run translate`) — traduce los 64 idiomas del sitio (ES/EN a mano,
  el resto generado). Mismo cliente/modelo que `descripciones.js`, y **estrictamente secuencial**
  (una sola llamada en vuelo para todo el proceso, con el mismo margen de ~4.5s entre llamadas):
  una tanda completa en frío son ~558 llamadas (62 idiomas × 9 páginas), así que puede tardar
  bastante y toparse con el límite diario antes de terminar. Es incremental y resumible: cachea
  por hash en `src/i18n/<lang>/.cache.json`, así que si se corta a medias (cuota agotada), la
  siguiente ejecución retoma justo donde se quedó sin repetir nada ya traducido. Corre en
  build/local, nunca en producción — el sitio generado es 100% estático.

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).
