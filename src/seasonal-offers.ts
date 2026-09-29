/**
 * The Seasonal offers collection: offers like Obstverkostung or Apfelsaft,
 * edited in Sveltia CMS (`/admin`), one Markdown file per offer in
 * `src/content/seasonal-offers/` (front matter plus the body). They replace
 * the old `/leistungen/obstverkostung/` and `/leistungen/apfelsaft/` pages and
 * the Apfelsaft popup: each offer has its own page `/saison/<slug>/`, and the
 * home page links it while it is in its window.
 *
 * The slug is the file name, which the CMS lets the editor set. The window
 * (`visible_from`, `visible_until`) is a month and a day each and recurs
 * every year (see `src/visibility.ts`).
 *
 * An offer without a complete window, or with invalid values, does not fail
 * the build: `parseSeasonalOffers` skips it with a `console.warn` (no page,
 * no teaser) and keeps the rest.
 */
import { MONTH_LABELS } from "./opening-hours";
import type { YearlyWindow } from "./visibility";

export interface MonthDay {
  month: number;
  day: number;
}

export interface SeasonalOffer {
  slug: string;
  title: string;
  /** Repository path of the image, e.g. `/src/assets/images/apfelsaft.jpg`. */
  image?: string;
  from: MonthDay;
  until: MonthDay;
  window: YearlyWindow;
}

type Data = Record<string, unknown>;

// February counts 29 days, so a window can start or end on a leap day.
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Offers from the collection's front matter (path → front matter), valid ones
 * only, sorted by the start of their window, then by slug. A file may carry
 * more (the rendered body); that is passed through untouched.
 */
export function parseSeasonalOffers<T>(
  files: Record<string, { frontmatter: unknown } & T>,
): (T & { offer: SeasonalOffer })[] {
  return Object.entries(files)
    .flatMap(([path, file]) => {
      const slug = slugOf(path);
      try {
        return [{ ...file, offer: parseSeasonalOffer(slug, file.frontmatter) }];
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        console.warn(
          `Seasonal offers: skipping ${slug}, it will not show until fixed in the CMS - ${reason}`,
        );
        return [];
      }
    })
    .sort(
      (a, b) =>
        a.offer.window.from.localeCompare(b.offer.window.from) ||
        a.offer.slug.localeCompare(b.offer.slug),
    );
}

export function parseSeasonalOffer(slug: string, raw: unknown): SeasonalOffer {
  if (!SLUG.test(slug)) {
    throw new Error("the slug may only hold a-z, 0-9 and single hyphens");
  }
  const data = record(raw ?? {}, "front matter");
  const title = text(data.title, "title");
  if (title === undefined) throw new Error("title is required");
  const from = monthDay(data.visible_from, "visible_from");
  const until = monthDay(data.visible_until, "visible_until");
  const offer: SeasonalOffer = {
    slug,
    title,
    from,
    until,
    window: { kind: "yearly", from: key(from), until: key(until) },
  };
  const image = text(data.image, "image");
  if (image !== undefined) offer.image = image;
  return offer;
}

/** A month/day as text, e.g. `1. September`. */
export function monthDayText({ month, day }: MonthDay): string {
  return `${day}. ${MONTH_LABELS[month - 1]}`;
}

/** The offer's window as text, e.g. `1. September bis 30. November`. */
export function windowText(offer: SeasonalOffer): string {
  return `${monthDayText(offer.from)} bis ${monthDayText(offer.until)}`;
}

function monthDay(value: unknown, field: string): MonthDay {
  if (value === undefined || value === null || value === "") {
    throw new Error(`${field} is required`);
  }
  const data = record(value, field);
  const month = integer(data.month, `${field}.month`);
  const day = integer(data.day, `${field}.day`);
  if (month < 1 || month > 12) {
    throw new Error(`${field}.month must be between 1 and 12`);
  }
  const last = DAYS_IN_MONTH[month - 1]!;
  if (day < 1 || day > last) {
    throw new Error(`${field}.day must be between 1 and ${last}`);
  }
  return { month, day };
}

function key({ month, day }: MonthDay): string {
  return `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function slugOf(path: string): string {
  return (path.split("/").at(-1) ?? path).replace(/\.[^.]+$/, "");
}

function integer(value: unknown, field: string): number {
  const number =
    typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof number !== "number" || !Number.isInteger(number)) {
    throw new Error(`${field} is required and must be a whole number`);
  }
  return number;
}

function record(value: unknown, field: string): Data {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${field} must be an object`);
  }
  return value as Data;
}

function text(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw new Error(`${field} must be text`);
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}
