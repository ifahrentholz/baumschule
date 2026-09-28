import { describe, expect, it } from "vitest";
import {
  findInternalUrls,
  hasNoindexMeta,
  isCheckedFile,
  isOutsideBase,
  robotsTxtDisallowsAll,
  verifyDist,
} from "./dist-checks";

const PHASE_1 = { site: "https://ifahrentholz.de", base: "/baumschule" };
const PHASE_2 = { site: "https://www.baumschule-fischer.de", base: "/" };

function urls(path: string, content: string, target = PHASE_1): string[] {
  return findInternalUrls({ path, content }, target);
}

describe("findInternalUrls", () => {
  it("finds root-relative URLs in double-quoted, single-quoted and unquoted attributes", () => {
    const html = `<a href="/a">x</a><img src='/b.png'><form action=/c></form>`;
    expect(urls("index.html", html)).toEqual(["/a", "/b.png", "/c"]);
  });

  it("finds every candidate in srcset, including the width/density descriptors' URLs", () => {
    const html = `<img srcset="/baumschule/s.png 1x, /t.png 2x">`;
    expect(urls("index.html", html)).toEqual(["/baumschule/s.png", "/t.png"]);
  });

  it("keeps commas that are part of a srcset URL", () => {
    const html = `<img srcset="/img/a,b.png 1x,/img/c.png 2x, /img/d.png">`;
    expect(urls("index.html", html)).toEqual([
      "/img/a,b.png",
      "/img/c.png",
      "/img/d.png",
    ]);
  });

  it("finds CSS url() values, quoted or not, in stylesheets and inline styles", () => {
    const css = `a{background:url(/x.png)} b{background:url('/y.png')} c{background:url("/z.png")}`;
    expect(urls("_astro/site.css", css)).toEqual([
      "/x.png",
      "/y.png",
      "/z.png",
    ]);
    const html = `<div style="background: url('/w.png')"></div>`;
    expect(urls("index.html", html)).toEqual(["/w.png"]);
  });

  it("finds CSS @import strings", () => {
    expect(urls("_astro/site.css", `@import "/base.css";`)).toEqual([
      "/base.css",
    ]);
  });

  it("finds the target of a meta refresh redirect", () => {
    const html = `<meta http-equiv="refresh" content="0;url=/x">
      <meta content="2; URL='/y'" http-equiv="Refresh">
      <meta http-equiv="refresh" content="5">`;
    expect(urls("index.html", html)).toEqual(["/x", "/y"]);
  });

  it("reduces absolute and protocol-relative URLs on the site's own origin to their path", () => {
    const html = `<a href="https://ifahrentholz.de/about">x</a><a href="//ifahrentholz.de/b">y</a>`;
    expect(urls("index.html", html)).toEqual(["/about", "/b"]);
  });

  it("treats the www. and the bare domain as the same own origin", () => {
    const html = `<a href="https://baumschule-fischer.de/a">x</a><a href="https://www.baumschule-fischer.de/b">y</a>`;
    expect(urls("index.html", html, PHASE_2)).toEqual(["/a", "/b"]);
    expect(
      urls("index.html", `<a href="https://www.ifahrentholz.de/c">z</a>`),
    ).toEqual(["/c"]);
  });

  it("resolves relative URLs against the file's own location below the base", () => {
    const html = `<a href="rel">r</a><a href="../../x">x</a><a href="/baumschule/../y">y</a>`;
    expect(urls("about/index.html", html)).toEqual([
      "/baumschule/about/rel",
      "/x",
      "/y",
    ]);
    expect(urls("_astro/site.css", "a{background:url(../../b.png)}")).toEqual([
      "/b.png",
    ]);
  });

  it("ignores foreign origins and non-http schemes", () => {
    const html = `<a href="https://example.com/x">x</a>
      <a href="mailto:a@b.de">m</a><a href="tel:+49">t</a><img src="data:image/png;base64,AA">`;
    expect(urls("index.html", html)).toEqual([]);
  });

  it("finds root-relative and own-origin string literals in JavaScript, but not relative ones or lone slashes", () => {
    const js = `import("/_astro/a.js");location.href='/about';fetch(\`https://ifahrentholz.de/c\`);
      import("./b.js");x.split("/");const u="https://example.com/d";`;
    expect(urls("_astro/client.js", js)).toEqual([
      "/_astro/a.js",
      "/about",
      "/c",
    ]);
  });

  it("scans inline <script> blocks in HTML like JavaScript files", () => {
    const html = `<script>location.href = "/about";</script>
      <script type="module">import("/_astro/a.js");import("./b.js");x.split("/");</script>`;
    expect(urls("index.html", html)).toEqual(["/about", "/_astro/a.js"]);
  });

  it("finds own-origin absolute URLs in <meta content>, but not other text there", () => {
    const html = `<meta property="og:image" content="https://ifahrentholz.de/og.png">
      <meta content='https://www.ifahrentholz.de/baumschule/' property='og:url'>
      <meta name="description" content="Trees / shrubs, see https://example.com/x">
      <meta name="twitter:image" content="/rel.png">`;
    expect(urls("index.html", html)).toEqual(["/og.png", "/baumschule/"]);
  });

  it("finds own-origin absolute URLs anywhere in JSON-LD, and does not scan it as JavaScript", () => {
    const html = `<script type="application/ld+json">{"@context":"https://schema.org",
      "url":"https://ifahrentholz.de/kontakt","logo":{"contentUrl":"https:\\/\\/ifahrentholz.de\\/baumschule\\/l.png"},
      "sameAs":["https://example.com/p"],"path":"/not-a-url-here"}</script>`;
    expect(urls("index.html", html)).toEqual(["/kontakt", "/baumschule/l.png"]);
  });

  it("throws on JSON-LD that is not valid JSON", () => {
    expect(() =>
      urls("index.html", `<script type="application/ld+json">{</script>`),
    ).toThrow(/JSON-LD/);
  });

  it("finds sitemap <loc> entries and XML href attributes", () => {
    const xml = `<?xml version="1.0"?><?xml-stylesheet href="/sitemap.xsl"?>
      <urlset><url><loc>https://ifahrentholz.de/baumschule/</loc></url>
      <url><loc> https://ifahrentholz.de/about?a=1&amp;b=2 </loc>
      <xhtml:link rel="alternate" href="https://ifahrentholz.de/en"/></url></urlset>`;
    expect(urls("sitemap-0.xml", xml)).toEqual([
      "/sitemap.xsl",
      "/baumschule/",
      "/about?a=1&b=2",
      "/en",
    ]);
  });

  it("finds the URL fields of a web app manifest, resolving relative ones against the manifest", () => {
    const manifest = JSON.stringify({
      name: "Baumschule",
      start_url: "/",
      scope: "../",
      icons: [{ src: "icon.png", sizes: "192x192" }],
      shortcuts: [{ name: "About", url: "/baumschule/about" }],
    });
    expect(urls("site.webmanifest", manifest)).toEqual([
      "/",
      "/",
      "/baumschule/icon.png",
      "/baumschule/about",
    ]);
  });

  it("throws on a web app manifest that is not valid JSON", () => {
    expect(() => urls("site.webmanifest", "{")).toThrow(/JSON/);
  });
});

describe("isCheckedFile", () => {
  it("selects the file types that can carry URLs, plus robots.txt", () => {
    for (const path of [
      "index.html",
      "_astro/site.css",
      "_astro/client.js",
      "_astro/chunk.mjs",
      "sitemap-index.xml",
      "site.webmanifest",
      "robots.txt",
    ]) {
      expect(isCheckedFile(path), path).toBe(true);
    }
  });

  it("skips images, other text files and look-alike names", () => {
    for (const path of ["favicon.svg", "a.png", "notes.txt", "a/robots.txt"]) {
      expect(isCheckedFile(path), path).toBe(false);
    }
  });
});

describe("isOutsideBase", () => {
  it("accepts the base itself and anything below it", () => {
    expect(isOutsideBase("/baumschule", PHASE_1.base)).toBe(false);
    expect(isOutsideBase("/baumschule/", PHASE_1.base)).toBe(false);
    expect(isOutsideBase("/baumschule/a.png", PHASE_1.base)).toBe(false);
    expect(isOutsideBase("/baumschule?x=1", PHASE_1.base)).toBe(false);
    expect(isOutsideBase("/baumschule#top", PHASE_1.base)).toBe(false);
  });

  it("rejects paths outside the base, including look-alike prefixes", () => {
    expect(isOutsideBase("/", PHASE_1.base)).toBe(true);
    expect(isOutsideBase("/about", PHASE_1.base)).toBe(true);
    expect(isOutsideBase("/baumschulefoo", PHASE_1.base)).toBe(true);
  });

  it("accepts every path when the base is the root", () => {
    expect(isOutsideBase("/about", PHASE_2.base)).toBe(false);
  });
});

describe("hasNoindexMeta", () => {
  it("detects the robots meta regardless of quote style, attribute order and case", () => {
    expect(
      hasNoindexMeta(`<meta name="robots" content="noindex, nofollow">`),
    ).toBe(true);
    expect(hasNoindexMeta(`<meta content='NOINDEX' name='Robots' />`)).toBe(
      true,
    );
  });

  it("is false without a robots meta or when it allows indexing", () => {
    expect(hasNoindexMeta(`<meta name="viewport" content="noindex">`)).toBe(
      false,
    );
    expect(hasNoindexMeta(`<meta name="robots" content="index, follow">`)).toBe(
      false,
    );
    expect(hasNoindexMeta(`<title>noindex</title>`)).toBe(false);
  });
});

describe("verifyDist", () => {
  const previewPage = `<html><head><meta name="robots" content="noindex, nofollow">
    <link rel="icon" href="/baumschule/favicon.svg"></head></html>`;
  const livePage = `<html><head><link rel="icon" href="/favicon.svg"></head></html>`;
  const robots = "User-agent: *\nAllow: /\n";
  const blockingRobots = "User-agent: *\nDisallow: /\n";

  it("passes a correct preview build, whose robots.txt allows crawling", () => {
    const files = [
      { path: "index.html", content: previewPage },
      { path: "robots.txt", content: robots },
    ];
    expect(verifyDist(files, PHASE_1, "noindex")).toEqual([]);
  });

  it("passes a correct production build", () => {
    const files = [
      { path: "index.html", content: livePage },
      { path: "robots.txt", content: robots },
    ];
    expect(verifyDist(files, PHASE_2, "index")).toEqual([]);
  });

  it("reports URLs outside the base in HTML, CSS, JS, XML and manifests, naming the file", () => {
    const files = [
      {
        path: "index.html",
        content:
          previewPage +
          `<img srcset='/a.png 2x'><meta http-equiv="refresh" content="0;url=/r"><a href="../x">x</a>`,
      },
      { path: "_astro/site.css", content: "a{background:url(/b.png)}" },
      { path: "_astro/client.js", content: `location.href="/c"` },
      {
        path: "sitemap-0.xml",
        content:
          "<urlset><url><loc>https://ifahrentholz.de/d</loc></url></urlset>",
      },
      { path: "site.webmanifest", content: `{"start_url":"/"}` },
      { path: "robots.txt", content: robots },
    ];
    expect(verifyDist(files, PHASE_1, "noindex")).toEqual([
      "index.html: URL outside base /baumschule: /a.png",
      "index.html: URL outside base /baumschule: /r",
      "index.html: URL outside base /baumschule: /x",
      "_astro/site.css: URL outside base /baumschule: /b.png",
      "_astro/client.js: URL outside base /baumschule: /c",
      "sitemap-0.xml: URL outside base /baumschule: /d",
      "site.webmanifest: URL outside base /baumschule: /",
    ]);
  });

  it("reports the reviewer's probes: an inline script, an og:image meta and JSON-LD outside the base", () => {
    const files = [
      {
        path: "probe/index.html",
        content:
          previewPage +
          `<script>location.href = "/about";</script>
          <meta property="og:image" content="https://ifahrentholz.de/og.png">
          <script type="application/ld+json">{"url":"https://ifahrentholz.de/kontakt"}</script>`,
      },
      { path: "robots.txt", content: robots },
    ];
    expect(verifyDist(files, PHASE_1, "noindex")).toEqual([
      "probe/index.html: URL outside base /baumschule: /about",
      "probe/index.html: URL outside base /baumschule: /og.png",
      "probe/index.html: URL outside base /baumschule: /kontakt",
    ]);
  });

  it("reports a file whose URLs cannot be read", () => {
    const files = [
      { path: "index.html", content: previewPage },
      { path: "site.webmanifest", content: "{" },
      { path: "robots.txt", content: robots },
    ];
    const problems = verifyDist(files, PHASE_1, "noindex");
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/^site\.webmanifest: .*JSON/);
  });

  it("fails when there is no internal URL at all, because then nothing was checked", () => {
    const files = [
      { path: "index.html", content: `<meta name="robots" content="noindex">` },
      { path: "robots.txt", content: robots },
    ];
    expect(verifyDist(files, PHASE_1, "noindex")).toEqual([
      "no internal URL found in any checked file: the base-path check had nothing to check",
    ]);
  });

  it("reports a preview page without noindex and a preview robots.txt that blocks crawling", () => {
    const files = [
      {
        path: "index.html",
        content: livePage.replace("/favicon", "/baumschule/favicon"),
      },
      { path: "robots.txt", content: blockingRobots },
    ];
    expect(verifyDist(files, PHASE_1, "noindex")).toEqual([
      'index.html: missing <meta name="robots" content="noindex">',
      "robots.txt: must not contain Disallow: / (crawlers must reach the pages)",
    ]);
  });

  it("reports a production page with noindex and a production robots.txt with Disallow: /", () => {
    const files = [
      { path: "index.html", content: previewPage },
      { path: "robots.txt", content: blockingRobots },
    ];
    expect(verifyDist(files, PHASE_2, "index")).toEqual([
      "index.html: carries a noindex robots meta in an index build",
      "robots.txt: must not contain Disallow: / (crawlers must reach the pages)",
    ]);
  });

  it("reports a missing robots.txt and a build without HTML", () => {
    expect(verifyDist([], PHASE_1, "noindex")).toEqual([
      "no HTML file found",
      "robots.txt missing",
      "no internal URL found in any checked file: the base-path check had nothing to check",
    ]);
  });

  describe("the CMS admin page", () => {
    const adminPage = (base: string) =>
      `<html><head><meta name="robots" content="noindex, nofollow"></head>
      <body><script type="module" src="${base}/_astro/admin.js"></script></body></html>`;

    it("must carry noindex in the production build too", () => {
      const files = [
        { path: "index.html", content: livePage },
        {
          path: "admin/index.html",
          content: adminPage("").replace(/<meta name="robots"[^>]*>/, ""),
        },
        { path: "robots.txt", content: robots },
      ];
      expect(verifyDist(files, PHASE_2, "index")).toEqual([
        'admin/index.html: missing <meta name="robots" content="noindex">',
      ]);
      files[1]!.content = adminPage("");
      expect(verifyDist(files, PHASE_2, "index")).toEqual([]);
    });

    it("is itself checked against the base path", () => {
      const files = [
        { path: "index.html", content: previewPage },
        { path: "admin/index.html", content: adminPage("") },
        { path: "robots.txt", content: robots },
      ];
      expect(verifyDist(files, PHASE_1, "noindex")).toEqual([
        "admin/index.html: URL outside base /baumschule: /_astro/admin.js",
      ]);
    });

    it("skips the JS string check for scripts only the admin page loads: the CMS bundle's API paths are not site URLs", () => {
      const files = [
        { path: "index.html", content: previewPage },
        { path: "admin/index.html", content: adminPage("/baumschule") },
        {
          path: "_astro/admin.js",
          content:
            'import{a}from"./cms-core.js";fetch("/repos/x");import(`./lang.js`);new Worker(new URL("/baumschule/_astro/worker.js",import.meta.url))',
        },
        { path: "_astro/cms-core.js", content: 'fetch("/user")' },
        { path: "_astro/lang.js", content: 'x="/deep/"' },
        { path: "_astro/worker.js", content: 'x="/home/web_user"' },
        { path: "robots.txt", content: robots },
      ];
      expect(verifyDist(files, PHASE_1, "noindex")).toEqual([]);
    });

    it("still checks a script a site page loads, even if the admin page loads it too", () => {
      const files = [
        {
          path: "index.html",
          content:
            previewPage +
            `<script type="module" src="/baumschule/_astro/shared.js"></script>`,
        },
        { path: "admin/index.html", content: adminPage("/baumschule") },
        { path: "_astro/admin.js", content: 'import"./shared.js"' },
        { path: "_astro/shared.js", content: 'location.href="/c"' },
        { path: "_astro/orphan.js", content: 'location.href="/d"' },
        { path: "robots.txt", content: robots },
      ];
      expect(verifyDist(files, PHASE_1, "noindex")).toEqual([
        "_astro/shared.js: URL outside base /baumschule: /c",
        "_astro/orphan.js: URL outside base /baumschule: /d",
      ]);
    });
  });
});

describe("robotsTxtDisallowsAll", () => {
  it("is true only for a Disallow: / rule", () => {
    expect(robotsTxtDisallowsAll("User-agent: *\nDisallow: /\n")).toBe(true);
    expect(robotsTxtDisallowsAll("User-agent: *\r\ndisallow:/\r\n")).toBe(true);
    expect(robotsTxtDisallowsAll("User-agent: *\nAllow: /\n")).toBe(false);
    expect(robotsTxtDisallowsAll("User-agent: *\nDisallow: /admin\n")).toBe(
      false,
    );
  });
});
