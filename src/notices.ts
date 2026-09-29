/**
 * The Notices collection: short home page announcements edited in Sveltia CMS
 * (`/admin`), one JSON file per notice in `src/content/notices/`. They replace
 * the old home page's "Zeile 00" posts (Staudenmarkt, job teaser) and are
 * rendered by `src/components/Notices.astro`.
 *
 * A notice has a text, an optional link and a visibility window of calendar
 * dates (`visible_from`, `visible_until`, both optional and inclusive; see
 * `src/visibility.ts`). A link is either a site path (`/karriere/`), which
 * gets the base path, or an absolute `http(s)` URL.
 *
 * An invalid notice (missing text, bad date or link, `visible_until` before
 * `visible_from`) does not fail the build: `parseNotices` skips it with a
 * `console.warn` and keeps the rest, as the opening hours do for exceptions.
 * The CMS writes empty optional fields as empty strings; those count as
 * missing.
 */
import type { DateWindow } from "./visibility";

export interface Notice {
  /** File name without extension, e.g. `staudenmarkt`. */
  id: string;
  text: string;
  link?: string;
  window: DateWindow;
}

type Data = Record<string, unknown>;

/**
 * Notices from the collection's files (path → parsed JSON), valid ones only,
 * sorted by the start of their window (open start first), then by id.
 */
export function parseNotices(files: Record<string, unknown>): Notice[] {
  return Object.entries(files)
    .flatMap(([path, raw]) => {
      const id = idOf(path);
      try {
        return [parseNotice(id, raw)];
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        console.warn(
          `Notices: skipping ${id}, it will not show until fixed in the CMS - ${reason}`,
        );
        return [];
      }
    })
    .sort(
      (a, b) =>
        (a.window.from ?? "").localeCompare(b.window.from ?? "") ||
        a.id.localeCompare(b.id),
    );
}

export function parseNotice(id: string, raw: unknown): Notice {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("must be an object");
  }
  const data = raw as Data;
  const noticeText = text(data.text, "text");
  if (noticeText === undefined) throw new Error("text is required");
  const link = text(data.link, "link");
  if (link !== undefined && !/^(\/|https?:\/\/)/.test(link)) {
    throw new Error("link must be a site path (/...) or an http(s) URL");
  }
  const from = date(data.visible_from, "visible_from");
  const until = date(data.visible_until, "visible_until");
  if (from !== undefined && until !== undefined && until < from) {
    throw new Error("visible_until is before visible_from");
  }
  const window: DateWindow = { kind: "dates" };
  if (from !== undefined) window.from = from;
  if (until !== undefined) window.until = until;
  const notice: Notice = { id, text: noticeText, window };
  if (link !== undefined) notice.link = link;
  return notice;
}

/** The notice's link for the current deploy target. */
export function noticeHref(link: string, base: string): string {
  return link.startsWith("/") ? `${base.replace(/\/+$/, "")}${link}` : link;
}

function idOf(path: string): string {
  return (path.split("/").at(-1) ?? path).replace(/\.[^.]+$/, "");
}

function date(value: unknown, field: string): string | undefined {
  const iso = text(value, field);
  if (iso === undefined) return undefined;
  const valid =
    /^\d{4}-\d{2}-\d{2}$/.test(iso) &&
    new Date(`${iso}T00:00:00Z`).toISOString().startsWith(iso);
  if (!valid) throw new Error(`${field} must be a date (YYYY-MM-DD)`);
  return iso;
}

function text(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw new Error(`${field} must be text`);
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}
