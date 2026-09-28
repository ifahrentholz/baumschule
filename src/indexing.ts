/**
 * Resolves whether search engines may index the build, from the environment,
 * so phase 2 can switch indexing on without a code change.
 *
 * - `SITE_INDEXING` `noindex` (phase 1 preview) or `index` (phase 2 live site)
 *
 * Unset or empty falls back to `noindex`, so a forgotten variable can never
 * expose the preview to search engines.
 *
 * The `noindex` robots meta on every page is the only indexing protection.
 * robots.txt cannot help: in phase 1 it is served below the base path
 * (`/baumschule/robots.txt`), where crawlers never look, and a `Disallow: /`
 * would stop crawlers from fetching the pages and so from seeing the meta.
 */
export type Indexing = "noindex" | "index";

export type IndexingEnv = Partial<Record<"SITE_INDEXING", string>>;

const PHASE_1_INDEXING: Indexing = "noindex";

export function resolveIndexing(env: IndexingEnv): Indexing {
  const value = env.SITE_INDEXING || PHASE_1_INDEXING;
  if (value !== "noindex" && value !== "index") {
    throw new Error(
      `SITE_INDEXING must be "noindex" or "index", got "${value}"`,
    );
  }
  return value;
}

/**
 * The site's robots.txt, the same in both phases: it allows crawling so the
 * noindex meta is seen (see above). A sitemap line joins it once the site
 * generates a sitemap.
 */
export function renderRobotsTxt(): string {
  return "User-agent: *\nAllow: /\n";
}
