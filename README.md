# baumschule

Static site for Baumschule Fischer, built with [Astro](https://astro.build).

## Development

Requires Node.js 24 or newer (see `.nvmrc`).

```sh
npm ci
npm run dev           # local dev server
npm run build         # static build into dist/
npm run check         # typecheck (astro check)
npm test              # unit tests (vitest)
npm run format:check  # formatting (prettier)
```

## Deploy target

`site`, `base` and search-engine indexing are read from the environment at
build time:

| Variable        | Default                   | Phase 2 (All-Inkl)                  |
| --------------- | ------------------------- | ----------------------------------- |
| `SITE_URL`      | `https://ifahrentholz.de` | `https://www.baumschule-fischer.de` |
| `BASE_PATH`     | `/baumschule`             | `/`                                 |
| `SITE_INDEXING` | `noindex`                 | `index`                             |

`SITE_INDEXING=noindex` adds `<meta name="robots" content="noindex, nofollow">`
to every page (via `src/layouts/BaseLayout.astro`); `index` drops the meta.
The generated `robots.txt` is the same in both phases and allows crawling
(`Allow: /`).

`SITE_URL` must be a bare origin (no path, query or fragment); the path
prefix belongs in `BASE_PATH`, otherwise it would appear twice in URLs.

## Deploy (phase 1)

Every push to `main` builds the site in CI and deploys `dist/` to GitHub Pages
(`https://ifahrentholz.de/baumschule`).

In phase 1 the `noindex` meta robots tag is the only thing that keeps the
preview out of search results. `robots.txt` cannot help. Crawlers read it
only from the root of a host, and the preview's copy is served at
`/baumschule/robots.txt`, where no crawler looks. The root `robots.txt`
belongs to the `ifahrentholz.github.io` repository, and this project
deliberately leaves it alone. Also, a `Disallow: /` would stop crawlers from
fetching the pages, so they would never see the noindex meta. That is why
`robots.txt` allows crawling.

After each build CI runs `node scripts/verify-dist.ts` with the build's
environment. It fails if:

- the noindex meta does not match `SITE_INDEXING` on every HTML page;
- `robots.txt` is missing or contains `Disallow: /`;
- any internal URL leaves the base path. The check covers HTML attributes,
  `srcset`, meta refresh, absolute URLs in `<meta content>` (e.g. `og:image`)
  and JSON-LD, CSS `url()`/`@import`, JS string literals (in JS files and
  inline `<script>` blocks), sitemap XML and `.webmanifest` files. Relative URLs are resolved against the file
  they appear in, and absolute URLs on the site's own host (with or without
  `www.`) are included.

CI also builds and checks the phase 2 variant.
