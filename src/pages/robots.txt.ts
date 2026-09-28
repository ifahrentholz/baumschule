import type { APIRoute } from "astro";
import { renderRobotsTxt } from "../indexing";

// Generated at build time. It never blocks crawling: the preview is kept out
// of search results by the noindex meta alone (see src/indexing.ts).
export const GET: APIRoute = () =>
  new Response(renderRobotsTxt(), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
