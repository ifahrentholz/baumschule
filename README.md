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

`site` and `base` are read from the environment at build time:

| Variable    | Default                   | Phase 2 (All-Inkl)                  |
| ----------- | ------------------------- | ----------------------------------- |
| `SITE_URL`  | `https://ifahrentholz.de` | `https://www.baumschule-fischer.de` |
| `BASE_PATH` | `/baumschule`             | `/`                                 |
