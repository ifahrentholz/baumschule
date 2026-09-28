/**
 * Pure checks over the built site in `dist/`, used by `scripts/verify-dist.ts`
 * in CI (AC-10: base path and noindex).
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

function manifestUrls(json: string): Candidate[] {
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
      if (key !== undefined && MANIFEST_URL_KEYS.has(key)) {
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
