## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

`astro dev` does NOT serve `functions/` (Cloudflare Pages Functions) — any `/api/*` route 404s
there. To test the panel, `/api/track`, `/api/proyectos/tiempos`, or any other Function locally,
use `npm run panel:dev` instead (builds + `wrangler pages dev dist`). See README.md's "Probar las
Cloudflare Pages Functions en local" section for the two separate local env files involved
(`.env` for `astro dev`, `.dev.vars` for `panel:dev`).

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
