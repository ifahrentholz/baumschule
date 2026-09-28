import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ASSORTMENT_CATEGORIES,
  LEGAL_NAV,
  MAIN_NAV,
  SERVICES,
  allPages,
  breadcrumbTrail,
  currentState,
  withBase,
} from "./navigation";

describe("withBase", () => {
  it("prefixes a site path with the phase 1 base path", () => {
    expect(withBase("/baumschule", "/sortiment/")).toBe(
      "/baumschule/sortiment/",
    );
    expect(withBase("/baumschule/", "/sortiment/")).toBe(
      "/baumschule/sortiment/",
    );
  });

  it("links home to the base path itself", () => {
    expect(withBase("/baumschule", "/")).toBe("/baumschule/");
    expect(withBase("/", "/")).toBe("/");
  });

  it("leaves paths unchanged below the phase 2 root base", () => {
    expect(withBase("/", "/kontakt/")).toBe("/kontakt/");
  });
});

describe("the information architecture", () => {
  const pages = allPages();

  it("uses site paths with a leading and a trailing slash", () => {
    for (const page of pages) {
      expect(page.path).toMatch(/^\/([a-z0-9-]+\/)*$/);
    }
  });

  it("lists every page once", () => {
    const paths = pages.map((page) => page.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("covers the page tree of the spec (section 4), except the seasonal offers", () => {
    const paths = pages.map((page) => page.path);
    for (const path of [
      "/sortiment/",
      "/sortiment/obstgehoelze/",
      "/service/",
      "/service/beratung/",
      "/gutscheine/",
      "/ratgeber/",
      "/katalog/",
      "/besuch/",
      "/ueber-uns/",
      "/karriere/",
      "/kontakt/",
      "/impressum/",
      "/datenschutz/",
      "/agb/",
      "/widerruf/",
    ]) {
      expect(paths).toContain(path);
    }
    expect(ASSORTMENT_CATEGORIES).toHaveLength(7);
    expect(SERVICES).toHaveLength(4);
  });

  it("puts the legal pages in the footer, not in the main navigation", () => {
    const main = MAIN_NAV.flatMap((item) => [item, ...(item.children ?? [])]);
    for (const legal of LEGAL_NAV) {
      expect(main.map((item) => item.path)).not.toContain(legal.path);
    }
  });

  it("has a page in src/pages for every path", () => {
    for (const { path } of pages) {
      const segments = path.split("/").filter(Boolean);
      const parent = segments.slice(0, -1).join("/");
      const candidates = [
        `src/pages/${segments.join("/")}/index.astro`,
        `src/pages/${segments.join("/")}.astro`,
        `src/pages/${parent}/[slug].astro`,
        `src/pages/${parent}/[slug]/index.astro`,
      ];
      expect(
        candidates.some((file) => existsSync(file)),
        `no page for ${path}`,
      ).toBe(true);
    }
  });
});

describe("breadcrumbTrail", () => {
  it("follows the navigation tree from the top-level section to the page", () => {
    expect(
      breadcrumbTrail("/sortiment/rosen/").map((item) => item.label),
    ).toEqual(["Sortiment", "Rosen"]);
  });

  it("follows the grouping even where the URL is flat", () => {
    expect(breadcrumbTrail("/karriere/").map((item) => item.label)).toEqual([
      "Über uns",
      "Karriere",
    ]);
  });

  it("finds footer pages", () => {
    expect(breadcrumbTrail("/impressum/").map((item) => item.label)).toEqual([
      "Impressum",
    ]);
  });

  it("is empty for a path outside the tree", () => {
    expect(breadcrumbTrail("/unbekannt/")).toEqual([]);
  });
});

describe("currentState", () => {
  it("marks the item of the current page", () => {
    expect(currentState("/kontakt/", "/kontakt/")).toBe("page");
  });

  it("marks the section of a page further down the tree", () => {
    expect(currentState("/sortiment/rosen/", "/sortiment/")).toBe("section");
    expect(currentState("/karriere/", "/ueber-uns/")).toBe("section");
  });

  it("does not mark unrelated items", () => {
    expect(currentState("/kontakt/", "/sortiment/")).toBe(false);
    expect(currentState("/", "/sortiment/")).toBe(false);
  });

  it("tolerates a missing trailing slash in the current path", () => {
    expect(currentState("/kontakt", "/kontakt/")).toBe("page");
  });
});
