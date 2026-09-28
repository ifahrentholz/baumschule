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

The CMS editing UI below `admin/` is handled on purpose: its page must carry
the noindex meta in both phases, and the scripts only it loads (the bundled
Sveltia CMS, whose GitHub API paths like `"/user"` look like site URLs to the
JS check) are skipped by the base-path check. The admin page itself, and any
script a site page loads, is still checked.

## Content editing (Sveltia CMS)

Content is edited with [Sveltia CMS](https://sveltiacms.app/) at `/admin/`
(phase 1: `https://ifahrentholz.de/baumschule/admin/`). The CMS is installed
from npm and bundled into the build, so no script is loaded from a CDN. Its
configuration lives in `src/cms-config.ts` and is passed to `CMS.init()` in
full; there is no `config.yml`.

Saving in the CMS commits straight to `main`, which triggers the deploy above.

**Signing in (phase 1).** Each editor needs a GitHub account with write
access to this repository. On the CMS login screen choose "Sign In with
Token" and paste a GitHub personal access token: a fine-grained token for
`ifahrentholz/baumschule` with the repository permission _Contents: Read and
write_ (or a classic token with the `repo` scope). The token is kept in the
browser's local storage. Phase 2 adds GitHub sign-in through an OAuth helper.
This is **assumption A1** (spec §8): confirmed against Sveltia's docs and
source, but not yet tried in a browser — the owner still needs to verify it
by actually signing in once this branch is merged and deployed.

**Settings** (`src/content/settings.json`) holds the company data: name,
operators, address, phone, fax, e-mail, VAT ID, logo and brand colours.
Header and footer read it through `src/site-settings.ts`; blank fields are
not rendered. Uploaded images are stored in `src/assets/images/` and
optimised at build time.

The company data was filled in from the content inventory of the live site
(`.omnigent/runs/explore-site-inventory/report.md`); fax and e-mail were not
stated there, so both stay blank until an editor adds them through the CMS.
**The logo (`src/assets/images/logo.svg`) and `brand_colors` are still a
placeholder**, not the company's real logo or brand colours — replace them
through the CMS once the real assets are available (#4).
