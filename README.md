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

## Variables de entorno y secrets (Cloudflare Pages)

Este sitio corre en Cloudflare Pages con Functions en `functions/api/`. Además de `wrangler.toml`
(binding D1 `DB` → base `web-mario-analitica`), estas variables tienen que existir en el entorno
de **Production** del proyecto de Pages (Dashboard → proyecto → Settings → Environment variables,
o por CLI) — el `.env`/`.dev.vars` local **no** se sincronizan solos con producción:

| Variable          | Usada por                                                              | Notas                                                                 |
| ----------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `GEMINI_API_KEY`  | `functions/api/traducir.js`, `functions/api/cv-pdf.js`, `src/lib/descripciones.js` (en build) | Google Gemini (`@google/generative-ai`), modelo `gemini-flash-latest`. Cuota gratuita muy ajustada (ver aviso abajo) y **compartida** entre las tres funciones. |
| `GITHUB_TOKEN`    | `functions/api/guardar.js`, `cv-pdf.js`, `chat.js`, `functions/api/_lib.js` | Token con permisos de escritura sobre `GITHUB_REPO`.                  |
| `GITHUB_REPO`     | igual que arriba                                                       | Formato `owner/repo`.                                                 |
| `SESSION_SECRET`  | `functions/api/_auth.js`                                               | Firma HMAC de la cookie de sesión del panel.                          |

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

### ⚠️ Cuota de Gemini y la traducción automática

El modelo `gemini-flash-latest` tiene, en el nivel gratuito, un límite muy bajo de peticiones al
día (verificado en producción: 20/día para el modelo al que resuelve ahora mismo). Esa cuota la
comparten `/api/traducir`, la generación de descripciones de proyectos (`descripciones.js`, que
llama a Gemini en cada build/deploy) y la traducción del CV (`cv-pdf.js`). `traducir.js` cachea
cada traducción completa en D1 (tabla `traducciones_cache`, por ruta+idioma+hash del contenido)
para no repetir llamadas — pero la **primera** vez que se traduce cada página a cada idioma sí
consume cuota, y con ~30 idiomas × varias páginas es fácil agotarla en un día. Si la cuota se agota,
el endpoint no rompe: reintenta con backoff, y si aun así falla devuelve el texto original para esa
parte en vez de un error duro. Subir de plan en Google AI Studio o repartir la traducción entre
varios días son las dos salidas si esto se vuelve un problema real.

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).
