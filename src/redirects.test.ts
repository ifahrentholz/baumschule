import { describe, expect, it } from "vitest";
import { allPages } from "./navigation";
import { OLD_SITE_URLS, REDIRECTS, oldSitePath } from "./redirects";

describe("oldSitePath", () => {
  it("reduces an old-site URL to its path", () => {
    expect(oldSitePath("https://www.baumschule-fischer.de/karte/")).toBe(
      "/karte/",
    );
  });

  it("keeps the query string, which is all that identifies some old URLs", () => {
    expect(oldSitePath("https://www.baumschule-fischer.de/?page_id=4110")).toBe(
      "/?page_id=4110",
    );
  });
});

describe("the old URL list", () => {
  it("holds the 33 pages, 18 posts and 1 popup template of the old sitemap", () => {
    expect(OLD_SITE_URLS.pages).toHaveLength(33);
    expect(OLD_SITE_URLS.posts).toHaveLength(18);
    expect(OLD_SITE_URLS.templates).toHaveLength(1);
  });

  it("includes the known post permalinks and the page_id alias", () => {
    const paths = Object.values(OLD_SITE_URLS).flat().map(oldSitePath);
    for (const path of [
      "/karte/",
      "/geoeffnet-status/",
      "/spaziergang/",
      "/geaenderte-oeffnungszeiten-an-samstagen/",
      "/?wpr_templates=user-popup-apfelsaft",
      "/?page_id=4110",
    ]) {
      expect(paths).toContain(path);
    }
  });

  it("lists every URL once", () => {
    const urls = Object.values(OLD_SITE_URLS).flat();
    expect(new Set(urls).size).toBe(urls.length);
  });
});

describe("the redirect map", () => {
  const oldPaths = Object.values(OLD_SITE_URLS).flat().map(oldSitePath);
  const froms = REDIRECTS.map((redirect) => redirect.from);

  it("maps every old URL", () => {
    for (const path of oldPaths) {
      expect(froms, `no redirect for ${path}`).toContain(path);
    }
  });

  it("maps no old URL twice", () => {
    const duplicates = froms.filter((from, i) => froms.indexOf(from) !== i);
    expect(duplicates).toEqual([]);
  });

  it("maps only URLs from the old URL list", () => {
    for (const from of froms) {
      expect(oldPaths, `${from} is not an old URL`).toContain(from);
    }
  });

  it("points every redirect at a page of the new information architecture", () => {
    const targets = ["/", ...allPages().map((page) => page.path)];
    for (const { from, to } of REDIRECTS) {
      expect(targets, `${from} → ${to}`).toContain(to);
    }
  });

  it("explains every redirect that does not keep the path", () => {
    for (const redirect of REDIRECTS) {
      if (redirect.from !== redirect.to) {
        expect(redirect.reason, `${redirect.from} needs a reason`).toMatch(
          /\S/,
        );
      }
    }
  });

  it("does not carry the known defects over as targets", () => {
    const targets = REDIRECTS.map((redirect) => redirect.to);
    expect(targets).not.toContain("/spaziergang/");
    expect(targets).not.toContain("/geaenderte-oeffnungszeiten-an-samstagen/");
  });
});
