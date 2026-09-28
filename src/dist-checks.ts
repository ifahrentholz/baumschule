/**
 * Pure checks over the built site in `dist/`, used by `scripts/verify-dist.ts`
 * in CI (AC-10: base path and noindex; AC-7: no third-party requests and no
 * cookies on the public pages).
 */
import type { DeployTarget } from "./deploy-target";
import type { Indexing } from "./indexing";

export interface DistFile {
  /** Path relative to `dist/`, with `/` separators. */
  path: string;
  content: string;
}

const URL_ATTRIBUTE =
  /(?:^|[\s"'/])((?:xlink:)?href|src|action|formaction|poster|srcset|imagesrcset)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi;
const SRCSET_ATTRIBUTE = /^(?:srcset|imagesrcset)$/i;
const CSS_URL = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)/gi;
const CSS_IMPORT = /@import\s+(?:"([^"]*)"|'([^']*)')/gi;
const XML_LOC = /<((?:[\w-]+:)?loc)>([^<]*)<\/\1>/gi;
const META_REFRESH_URL = /^\s*[\d.]*\s*(?:[;,]\s*)?(?:url\s*=\s*)?(.*)$/is;
// JS has no URL syntax, so only string literals that are unmistakably URLs
// count: root-relative paths starting with a path character (not a lone "/",
// which is common in string handling) and absolute or protocol-relative URLs.
const JS_URL_STRING =
  /(["'`])(\/[A-Za-z0-9_.~%-][^"'`\s\\]*|(?:https?:)?\/\/[^"'`\s\\]+)\1/g;
// Free text (meta content, JSON-LD strings) is not a URL context, so only
// absolute URLs inside it count.
const ABSOLUTE_URL = /https?:\/\/[^\s"'<>`]+/gi;
const INLINE_SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
const MANIFEST_URL_KEYS = new Set([
  "src",
  "start_url",
  "scope",
  "id",
  "url",
  "action",
]);
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
// Relative module specifiers in bundled JS: static and dynamic imports, and
// `new URL(..., import.meta.url)` (workers, wasm).
const RELATIVE_SPECIFIER =
  /(?:\bfrom\s*|\bimport\s*\(?\s*|\bnew\s+URL\s*\(\s*)(["'`])(\.{1,2}\/[^"'`\s\\]+)\1/g;

// AC-7: what a page loads by itself, as opposed to links a visitor follows.
// Any element's `src`/`srcset`/`poster` is fetched; `href` is only fetched on
// these elements (not on `<a>`/`<area>`, which are navigation).
const HTML_TAG = /<([a-z][\w:-]*)\b((?:[^>"']|"[^"]*"|'[^']*')*)>/gi;
const LOADING_ATTRIBUTES = new Set([
  "src",
  "srcset",
  "imagesrcset",
  "poster",
  "background",
]);
const HREF_LOADING_ELEMENTS = new Set(["link", "image", "use", "feimage"]);
// `<link rel>` values that only describe a relation and fetch nothing; every
// other rel (stylesheet, preload, icon, manifest, preconnect, ...) counts.
const NAVIGATION_RELS = new Set([
  "alternate",
  "author",
  "bookmark",
  "canonical",
  "external",
  "help",
  "license",
  "me",
  "next",
  "nofollow",
  "noopener",
  "noreferrer",
  "prev",
  "tag",
]);
const INLINE_STYLE = /<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi;
// Script types the browser does not execute (data blocks).
const DATA_SCRIPT_TYPES = new Set(["application/ld+json", "application/json"]);
// An absolute or protocol-relative URL in a JS string literal.
const JS_ABSOLUTE = String.raw`(?:(?:https?|wss?):)?\/\/[^"'\`\s\\]+`;
// JS that requests a URL: fetch/import/workers/sockets/beacons, static
// imports, XHR `open(method, url)`, and assigning `src` or `srcset`.
const JS_REQUESTS = [
  new RegExp(
    String.raw`\b(?:fetch|import|importScripts|sendBeacon|WebSocket|EventSource|Worker|SharedWorker|Request|Audio)\s*\(\s*(["'\`])(${JS_ABSOLUTE})\1`,
    "g",
  ),
  new RegExp(String.raw`\b(?:from|import)\s*(["'\`])(${JS_ABSOLUTE})\1`, "g"),
  new RegExp(
    String.raw`\.open\s*\(\s*["'\`][A-Za-z]+["'\`]\s*,\s*(["'\`])(${JS_ABSOLUTE})\1`,
    "g",
  ),
  new RegExp(
    String.raw`(?:\.(?:src|srcset)\s*=|\bsetAttribute\s*\(\s*["'\`](?:src|srcset)["'\`]\s*,)\s*(["'\`])(${JS_ABSOLUTE})\1`,
    "g",
  ),
];
const COOKIE_WRITES = [
  /\bdocument\s*\.\s*cookie\s*=(?!=)/,
  /\bdocument\s*\[\s*(["'`])cookie\1\s*\]\s*=(?!=)/,
  /\bcookieStore\s*\.\s*set\s*\(/,
];

/** The Sveltia CMS editing UI lives below this dist/ folder (`/admin`). */
const ADMIN_DIR = "admin/";

type FileKind = "html" | "css" | "js" | "xml" | "manifest";

interface Candidate {
  index: number;
  value: string;
  /** Set where a relative-looking string is not reliably a URL (JS). */
  absoluteOnly?: boolean;
}

function kindOf(path: string): FileKind | null {
  if (/\.html?$/i.test(path)) return "html";
  if (/\.css$/i.test(path)) return "css";
  if (/\.m?js$/i.test(path)) return "js";
  if (/\.xml$/i.test(path)) return "xml";
  if (/\.webmanifest$/i.test(path)) return "manifest";
  return null;
}

/** True for the files `verifyDist` reads: those that can carry URLs, and robots.txt. */
export function isCheckedFile(path: string): boolean {
  return path === "robots.txt" || kindOf(path) !== null;
}

/**
 * Returns every URL in a built file that points at the site itself, as
 * path + query + fragment, in document order. Relative URLs are resolved
 * against the file's own URL below the base path (except in JS, where a
 * relative-looking string is not reliably a URL), so `../` escapes show up as
 * the path they reach. Absolute URLs count when they are on the site's host,
 * with or without `www.`. Foreign hosts and non-http schemes are not returned.
 * In HTML, inline `<script>` blocks are scanned like JS files, and `<meta
 * content>` values and JSON-LD strings are scanned for absolute URLs.
 *
 * Throws if a web app manifest or a JSON-LD block is not valid JSON.
 */
export function findInternalUrls(
  file: DistFile,
  target: DeployTarget,
): string[] {
  const kind = kindOf(file.path);
  if (kind === null) return [];
  const text = file.content;

  let found: Candidate[];
  switch (kind) {
    case "html":
      found = [
        ...attributeUrls(text),
        ...metaRefreshUrls(text),
        ...metaContentUrls(text),
        ...cssUrls(text, true),
        ...inlineScriptUrls(text),
      ];
      break;
    case "css":
      found = cssUrls(text, false);
      break;
    case "xml":
      found = [...attributeUrls(text), ...xmlLocUrls(text)];
      break;
    case "js":
      found = jsUrls(text);
      break;
    case "manifest":
      found = manifestUrls(text);
      break;
  }

  const documentUrl = documentUrlOf(file.path, target);
  const hosts = ownHosts(target.site);
  return found
    .sort((a, b) => a.index - b.index)
    .map(({ value, absoluteOnly }) =>
      toInternalPath(value.trim(), documentUrl, hosts, !absoluteOnly),
    )
    .filter((path): path is string => path !== null);
}

/**
 * Checks a built site against its deploy target and indexing mode and returns
 * one message per problem (empty when the build is fine).
 */
export function verifyDist(
  files: DistFile[],
  target: DeployTarget,
  indexing: Indexing,
): string[] {
  const problems: string[] = [];
  let htmlFiles = 0;
  let internalUrls = 0;
  const cmsScripts = adminOnlyScripts(files, target);

  for (const file of files) {
    if (kindOf(file.path) === "html") {
      htmlFiles++;
      const noindex = hasNoindexMeta(file.content);
      // The editing UI is never content, so it stays noindex in both phases.
      const pageIndexing = isAdminPage(file.path) ? "noindex" : indexing;
      if (pageIndexing === "noindex" && !noindex) {
        problems.push(
          `${file.path}: missing <meta name="robots" content="noindex">`,
        );
      }
      if (pageIndexing === "index" && noindex) {
        problems.push(
          `${file.path}: carries a noindex robots meta in an index build`,
        );
      }
    }

    // AC-7 applies to the public site; the editing UI is exempt (open
    // question), and so is every script only it loads.
    if (!isAdminPage(file.path) && !cmsScripts.has(file.path)) {
      let requests: string[];
      try {
        requests = findThirdPartyRequests(file, target);
      } catch {
        // Unreadable files are reported by the base-path check below.
        requests = [];
      }
      for (const url of requests) {
        problems.push(`${file.path}: loads from a third-party origin: ${url}`);
      }
      if (setsCookie(file)) {
        problems.push(`${file.path}: sets a cookie`);
      }
    }

    // The CMS bundle is third-party code full of GitHub API paths ("/user",
    // "/repos/...") that the JS string heuristic would take for site URLs.
    // The admin page itself, and every script a site page loads, is checked.
    if (cmsScripts.has(file.path)) continue;

    let urls: string[];
    try {
      urls = findInternalUrls(file, target);
    } catch (error) {
      problems.push(`${file.path}: ${(error as Error).message}`);
      continue;
    }
    for (const url of urls) {
      internalUrls++;
      if (isOutsideBase(url, target.base)) {
        problems.push(`${file.path}: URL outside base ${target.base}: ${url}`);
      }
    }
  }

  if (htmlFiles === 0) problems.push("no HTML file found");

  // robots.txt never protects the preview (the noindex meta does), but a
  // `Disallow: /` would hide that meta from crawlers, in either phase.
  const robotsTxt = files.find((file) => file.path === "robots.txt");
  if (!robotsTxt) {
    problems.push("robots.txt missing");
  } else if (robotsTxtDisallowsAll(robotsTxt.content)) {
    problems.push(
      "robots.txt: must not contain Disallow: / (crawlers must reach the pages)",
    );
  }

  if (internalUrls === 0) {
    problems.push(
      "no internal URL found in any checked file: the base-path check had nothing to check",
    );
  }
  return problems;
}

/**
 * Returns every URL on a foreign origin that a built file makes the browser
 * request by itself, in document order (AC-7). In HTML that is any element's
 * `src`/`srcset`/`poster`, the `href` of `<link>` (except purely relational
 * rels like `canonical`) and of SVG `<image>`/`<use>`, CSS `url()`/`@import`
 * in `<style>` and `style=""`, and requests made by inline scripts. In CSS,
 * `url()`/`@import`; in JS, fetch/import/worker/socket/beacon/XHR URLs and
 * `src` assignments; in a web app manifest, icon `src`s. Links a visitor
 * follows (`<a href>`, form actions, redirects) are not requests.
 *
 * Throws if a web app manifest is not valid JSON.
 */
export function findThirdPartyRequests(
  file: DistFile,
  target: DeployTarget,
): string[] {
  const kind = kindOf(file.path);
  let found: Candidate[];
  switch (kind) {
    case "html":
      found = [
        ...loadingAttributeUrls(file.content),
        ...inlineStyleUrls(file.content),
        ...inlineScripts(file.content).flatMap(({ index, body }) =>
          jsRequestUrls(body).map((url) => ({
            ...url,
            index: index + url.index,
          })),
        ),
      ];
      break;
    case "css":
      found = cssUrls(file.content, false);
      break;
    case "js":
      found = jsRequestUrls(file.content);
      break;
    case "manifest":
      found = manifestUrls(file.content, new Set(["src"]));
      break;
    default:
      return [];
  }
  const documentUrl = documentUrlOf(file.path, target);
  const hosts = ownHosts(target.site);
  return found
    .sort((a, b) => a.index - b.index)
    .map(({ value }) => foreignUrl(value.trim(), documentUrl, hosts))
    .filter((url): url is string => url !== null);
}

/**
 * True if a built file's scripts set a cookie (`document.cookie = ...`,
 * `cookieStore.set(...)`), or an HTML page sets one through
 * `<meta http-equiv="set-cookie">` (AC-7).
 */
export function setsCookie(file: DistFile): boolean {
  const kind = kindOf(file.path);
  const writesCookie = (js: string) =>
    COOKIE_WRITES.some((pattern) => pattern.test(js));
  if (kind === "js") return writesCookie(file.content);
  if (kind !== "html") return false;
  for (const [tag] of file.content.matchAll(/<meta\b[^>]*>/gi)) {
    const httpEquiv = readAttributes(tag).get("http-equiv")?.toLowerCase();
    if (httpEquiv === "set-cookie") return true;
  }
  return inlineScripts(file.content).some(({ body }) => writesCookie(body));
}

/** True for an HTML page of the CMS editing UI. */
export function isAdminPage(path: string): boolean {
  return path.startsWith(ADMIN_DIR) && kindOf(path) === "html";
}

/**
 * The JS files that only the admin pages load, directly or through imports,
 * and no other page does. Scripts no page loads are not included.
 */
export function adminOnlyScripts(
  files: DistFile[],
  target: DeployTarget,
): Set<string> {
  const byPath = new Map(files.map((file) => [file.path, file]));
  const pages = files.filter((file) => kindOf(file.path) === "html");
  const fromAdmin = scriptsLoadedBy(
    pages.filter((page) => isAdminPage(page.path)),
    byPath,
    target,
  );
  const fromSite = scriptsLoadedBy(
    pages.filter((page) => !isAdminPage(page.path)),
    byPath,
    target,
  );
  return new Set([...fromAdmin].filter((path) => !fromSite.has(path)));
}

function scriptsLoadedBy(
  pages: DistFile[],
  byPath: Map<string, DistFile>,
  target: DeployTarget,
): Set<string> {
  const loaded = new Set<string>();
  const queue = [...pages];
  while (queue.length > 0) {
    const file = queue.pop()!;
    for (const path of scriptReferences(file, target)) {
      const script = byPath.get(path);
      if (loaded.has(path) || !script) continue;
      loaded.add(path);
      queue.push(script);
    }
  }
  return loaded;
}

/** dist/ paths of the JS files a file references. */
function scriptReferences(file: DistFile, target: DeployTarget): string[] {
  let urls: string[];
  try {
    urls = findInternalUrls(file, target);
  } catch {
    urls = [];
  }
  if (kindOf(file.path) === "js") {
    const documentUrl = documentUrlOf(file.path, target);
    for (const match of file.content.matchAll(RELATIVE_SPECIFIER)) {
      urls.push(new URL(match[2]!, documentUrl).pathname);
    }
  }
  return urls
    .map((url) => toDistPath(url.replace(/[?#].*$/, ""), target.base))
    .filter((path): path is string => path !== null && kindOf(path) === "js");
}

function toDistPath(path: string, base: string): string | null {
  const prefix = base === "/" ? "/" : `${base}/`;
  return path.startsWith(prefix) ? path.slice(prefix.length) : null;
}

function documentUrlOf(path: string, target: DeployTarget): URL {
  return new URL(
    target.base === "/" ? `/${path}` : `${target.base}/${path}`,
    target.site,
  );
}

/** True if a root-relative path escapes the base path. */
export function isOutsideBase(path: string, base: string): boolean {
  if (base === "/") return false;
  if (path === base) return false;
  return !["/", "?", "#"].some((next) => path.startsWith(base + next));
}

/** True if the HTML carries `<meta name="robots">` with `noindex` (or `none`). */
export function hasNoindexMeta(html: string): boolean {
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = readAttributes(tag);
    if (attributes.get("name")?.toLowerCase() !== "robots") continue;
    const directives = (attributes.get("content") ?? "")
      .toLowerCase()
      .split(",")
      .map((directive) => directive.trim());
    if (directives.includes("noindex") || directives.includes("none")) {
      return true;
    }
  }
  return false;
}

/** True if a robots.txt contains a `Disallow: /` rule. */
export function robotsTxtDisallowsAll(robotsTxt: string): boolean {
  return robotsTxt
    .split(/\r?\n/)
    .map((line) => line.replace(/#.*/, "").trim())
    .some((line) => /^disallow\s*:\s*\/$/i.test(line));
}

function toInternalPath(
  url: string,
  documentUrl: URL,
  hosts: Set<string>,
  allowRelative: boolean,
): string | null {
  if (!allowRelative && !url.startsWith("/") && !SCHEME.test(url)) return null;
  let parsed: URL;
  try {
    parsed = new URL(url, documentUrl);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (!hosts.has(parsed.host)) return null;
  return parsed.pathname + parsed.search + parsed.hash;
}

/** The site's host with and without `www.`: both serve the same site. */
function ownHosts(site: string): Set<string> {
  const bare = new URL(site).host.replace(/^www\./i, "");
  return new Set([bare, `www.${bare}`]);
}

/** The absolute URL, if it is http(s) or ws(s) on a host other than the site's. */
function foreignUrl(
  url: string,
  documentUrl: URL,
  hosts: Set<string>,
): string | null {
  // Only absolute and protocol-relative URLs can leave the site.
  if (!url.startsWith("//") && !SCHEME.test(url)) return null;
  let parsed: URL;
  try {
    parsed = new URL(url, documentUrl);
  } catch {
    return null;
  }
  if (!["http:", "https:", "ws:", "wss:"].includes(parsed.protocol)) {
    return null;
  }
  return hosts.has(parsed.host) ? null : parsed.href;
}

/** URLs the browser fetches for an HTML element's own attributes. */
function loadingAttributeUrls(html: string): Candidate[] {
  const found: Candidate[] = [];
  for (const match of html.matchAll(HTML_TAG)) {
    const element = match[1]!.toLowerCase();
    const attributes = readAttributes(match[0]);
    const push = (name: string) => {
      const value = decodeEntities(attributes.get(name) ?? "");
      const values = SRCSET_ATTRIBUTE.test(name) ? splitSrcset(value) : [value];
      for (const url of values) found.push({ index: match.index, value: url });
    };
    for (const name of attributes.keys()) {
      if (LOADING_ATTRIBUTES.has(name)) push(name);
    }
    if (element === "object" && attributes.has("data")) push("data");
    if (HREF_LOADING_ELEMENTS.has(element)) {
      const rels = (attributes.get("rel") ?? "")
        .toLowerCase()
        .split(/\s+/)
        .filter((rel) => rel !== "");
      const onlyRelational =
        element === "link" &&
        rels.length > 0 &&
        rels.every((rel) => NAVIGATION_RELS.has(rel));
      if (!onlyRelational) {
        if (attributes.has("href")) push("href");
        if (attributes.has("xlink:href")) push("xlink:href");
      }
    }
    const style = attributes.get("style");
    if (style !== undefined) {
      for (const url of cssUrls(decodeEntities(style), false)) {
        found.push({ index: match.index, value: url.value });
      }
    }
  }
  return found;
}

function inlineStyleUrls(html: string): Candidate[] {
  const found: Candidate[] = [];
  for (const match of html.matchAll(INLINE_STYLE)) {
    const bodyIndex = match.index + match[0].indexOf(">") + 1;
    for (const url of cssUrls(match[1]!, false)) {
      found.push({ index: bodyIndex + url.index, value: url.value });
    }
  }
  return found;
}

/** The bodies of the inline `<script>` blocks the browser executes. */
function inlineScripts(html: string): { index: number; body: string }[] {
  const scripts: { index: number; body: string }[] = [];
  for (const match of html.matchAll(INLINE_SCRIPT)) {
    const attributes = readAttributes(`<script${match[1]}>`);
    const type = attributes.get("type")?.trim().toLowerCase() ?? "";
    if (DATA_SCRIPT_TYPES.has(type)) continue;
    scripts.push({
      index: match.index + match[0].indexOf(">") + 1,
      body: match[2]!,
    });
  }
  return scripts;
}

function jsRequestUrls(js: string): Candidate[] {
  return JS_REQUESTS.flatMap((pattern) =>
    [...js.matchAll(pattern)].map((match) => ({
      index: match.index,
      value: match[2]!,
    })),
  );
}

function attributeUrls(text: string): Candidate[] {
  const found: Candidate[] = [];
  for (const match of text.matchAll(URL_ATTRIBUTE)) {
    const value = decodeEntities(match[2] ?? match[3] ?? match[4] ?? "");
    const values = SRCSET_ATTRIBUTE.test(match[1]!)
      ? splitSrcset(value)
      : [value];
    for (const candidate of values) {
      found.push({ index: match.index, value: candidate });
    }
  }
  return found;
}

/**
 * The URLs of a srcset, following the HTML parsing rules: a URL runs to the
 * next whitespace, so commas inside it are kept; a trailing comma or a comma
 * after the descriptors ends the candidate.
 */
function splitSrcset(srcset: string): string[] {
  const urls: string[] = [];
  let i = 0;
  while (i < srcset.length) {
    while (i < srcset.length && /[\s,]/.test(srcset[i]!)) i++;
    const start = i;
    while (i < srcset.length && !/\s/.test(srcset[i]!)) i++;
    let url = srcset.slice(start, i);
    if (url.endsWith(",")) {
      url = url.replace(/,+$/, "");
    } else {
      let depth = 0;
      for (; i < srcset.length; i++) {
        const char = srcset[i];
        if (char === "(") depth++;
        else if (char === ")") depth = Math.max(0, depth - 1);
        else if (char === "," && depth === 0) break;
      }
    }
    if (url !== "") urls.push(url);
  }
  return urls;
}

function metaRefreshUrls(html: string): Candidate[] {
  const found: Candidate[] = [];
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = readAttributes(match[0]);
    if (attributes.get("http-equiv")?.toLowerCase() !== "refresh") continue;
    const content = decodeEntities(attributes.get("content") ?? "");
    const url = stripQuotes(META_REFRESH_URL.exec(content)?.[1] ?? "");
    if (url !== "") found.push({ index: match.index, value: url });
  }
  return found;
}

/** Absolute URLs in `<meta content>`, e.g. og:image or og:url (not refresh). */
function metaContentUrls(html: string): Candidate[] {
  const found: Candidate[] = [];
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = readAttributes(match[0]);
    if (attributes.get("http-equiv")?.toLowerCase() === "refresh") continue;
    const content = decodeEntities(attributes.get("content") ?? "");
    for (const [url] of content.matchAll(ABSOLUTE_URL)) {
      found.push({ index: match.index, value: url });
    }
  }
  return found;
}

/**
 * URLs in inline `<script>` blocks: JSON-LD is parsed and its strings are
 * scanned for absolute URLs; every other script is scanned like a JS file.
 */
function inlineScriptUrls(html: string): Candidate[] {
  const found: Candidate[] = [];
  for (const match of html.matchAll(INLINE_SCRIPT)) {
    const attributes = readAttributes(`<script${match[1]}>`);
    const body = match[2]!;
    const bodyIndex = match.index + match[0].indexOf(">") + 1;
    const type = attributes.get("type")?.trim().toLowerCase();
    const urls =
      type === "application/ld+json" ? jsonLdUrls(body) : jsUrls(body);
    for (const url of urls) {
      found.push({ ...url, index: bodyIndex + url.index });
    }
  }
  return found;
}

function jsonLdUrls(json: string): Candidate[] {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch (error) {
    throw new Error(`JSON-LD is not valid JSON: ${(error as Error).message}`);
  }
  const found: Candidate[] = [];
  const walk = (node: unknown): void => {
    if (typeof node === "string") {
      for (const [url] of node.matchAll(ABSOLUTE_URL)) {
        found.push({ index: found.length, value: url });
      }
    } else if (Array.isArray(node)) {
      for (const item of node) walk(item);
    } else if (node !== null && typeof node === "object") {
      for (const child of Object.values(node)) walk(child);
    }
  };
  walk(data);
  return found;
}

function cssUrls(text: string, decode: boolean): Candidate[] {
  const read = decode ? decodeEntities : (value: string) => value;
  const found: Candidate[] = [];
  for (const match of text.matchAll(CSS_URL)) {
    const value =
      match[3] !== undefined
        ? stripQuotes(read(match[3]))
        : read(match[1] ?? match[2] ?? "");
    found.push({ index: match.index, value });
  }
  for (const match of text.matchAll(CSS_IMPORT)) {
    found.push({ index: match.index, value: read(match[1] ?? match[2] ?? "") });
  }
  return found;
}

function xmlLocUrls(xml: string): Candidate[] {
  return [...xml.matchAll(XML_LOC)].map((match) => ({
    index: match.index,
    value: decodeEntities(match[2]!),
  }));
}

function jsUrls(js: string): Candidate[] {
  return [...js.matchAll(JS_URL_STRING)].map((match) => ({
    index: match.index,
    value: match[2]!,
    absoluteOnly: true,
  }));
}

function manifestUrls(json: string, keys = MANIFEST_URL_KEYS): Candidate[] {
  let manifest: unknown;
  try {
    manifest = JSON.parse(json);
  } catch (error) {
    throw new Error(
      `web app manifest is not valid JSON: ${(error as Error).message}`,
    );
  }
  const found: Candidate[] = [];
  const walk = (node: unknown, key?: string): void => {
    if (typeof node === "string") {
      if (key !== undefined && keys.has(key)) {
        found.push({ index: found.length, value: node });
      }
    } else if (Array.isArray(node)) {
      for (const item of node) walk(item);
    } else if (node !== null && typeof node === "object") {
      for (const [childKey, child] of Object.entries(node)) {
        walk(child, childKey);
      }
    }
  };
  walk(manifest);
  return found;
}

function readAttributes(tag: string): Map<string, string> {
  const attributes = new Map<string, string>();
  const pattern =
    /([^\s"'=<>/]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  for (const match of tag.matchAll(pattern)) {
    attributes.set(
      match[1]!.toLowerCase(),
      match[2] ?? match[3] ?? match[4] ?? "",
    );
  }
  return attributes;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&#x0*2f;|&#0*47;/gi, "/")
    .replace(/&amp;/g, "&");
}

function stripQuotes(value: string): string {
  return value.trim().replace(/^(["'])(.*)\1$/, "$2");
}
