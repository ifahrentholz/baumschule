/**
 * Resolves Astro's `site` and `base` from the environment, so the same code
 * builds for phase 1 (GitHub Pages, `/baumschule`) and phase 2 (All-Inkl, `/`).
 *
 * - `SITE_URL`  absolute origin the site is served from
 * - `BASE_PATH` path prefix below that origin
 *
 * Unset or empty values fall back to the phase 1 target.
 */
export interface DeployTarget {
  site: string;
  base: string;
}

export type DeployEnv = Partial<Record<"SITE_URL" | "BASE_PATH", string>>;

const PHASE_1_TARGET: DeployTarget = {
  site: "https://ifahrentholz.de",
  base: "/baumschule",
};

export function resolveDeployTarget(env: DeployEnv): DeployTarget {
  const site = env.SITE_URL || PHASE_1_TARGET.site;
  const base = env.BASE_PATH || PHASE_1_TARGET.base;
  return { site: validateSite(site), base: normaliseBase(base) };
}

function validateSite(site: string): string {
  let url: URL;
  try {
    url = new URL(site);
  } catch {
    throw new Error(`SITE_URL must be an absolute http(s) URL, got "${site}"`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`SITE_URL must be an absolute http(s) URL, got "${site}"`);
  }
  return site;
}

function normaliseBase(base: string): string {
  const trimmed = base.replace(/^\/+|\/+$/g, "");
  return trimmed === "" ? "/" : `/${trimmed}`;
}
