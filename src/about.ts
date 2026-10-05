/**
 * The "Über uns" singleton, edited in Sveltia CMS (`/admin`) and stored in
 * `src/content/about.json`: the history timeline, the impressions gallery
 * and the partner links shown on `/ueber-uns/`.
 *
 * All three are ordered lists in one file rather than collections, so
 * editors reorder them by dragging; none of the items has a page of its own.
 * List order is display order. An invalid item does not fail the build: it
 * is skipped with a `console.warn` and the rest are kept.
 */
import {
  galleryImage,
  httpUrl,
  record,
  text,
  validItems,
  warnSkipped,
  type GalleryImage,
} from "./content-fields";

export interface TimelineEntry {
  /** A label rather than a number: "1955", "Ende 1950er", "Ab 1970". */
  year: string;
  text: string;
}

export interface PartnerLink {
  name: string;
  /** An absolute http(s) address. */
  url: string;
  description?: string;
}

export interface Impressions {
  heading?: string;
  intro?: string;
  images: GalleryImage[];
}

export interface AboutPage {
  timeline: TimelineEntry[];
  partners: PartnerLink[];
  impressions: Impressions;
}

const SINGLETON = "Über uns";

export function parseAboutPage(raw: unknown): AboutPage {
  let data: Record<string, unknown>;
  try {
    data = record(raw ?? {}, "about");
  } catch (error) {
    warnSkipped(SINGLETON, "the whole page", error);
    data = {};
  }
  return {
    timeline: validItems(SINGLETON, data.timeline, "timeline", timelineEntry),
    partners: validItems(SINGLETON, data.partners, "partners", partnerLink),
    impressions: parseImpressions(data.impressions),
  };
}

function parseImpressions(raw: unknown): Impressions {
  let data: Record<string, unknown>;
  try {
    data = record(raw ?? {}, "impressions");
  } catch (error) {
    warnSkipped(SINGLETON, "impressions", error);
    return { images: [] };
  }
  const impressions: Impressions = {
    images: validItems(
      SINGLETON,
      data.images,
      "impressions.images",
      galleryImage,
    ),
  };
  // A bad heading or intro only drops that text, not the gallery.
  for (const key of ["heading", "intro"] as const) {
    try {
      const value = text(data[key], `impressions.${key}`);
      if (value !== undefined) impressions[key] = value;
    } catch (error) {
      warnSkipped(SINGLETON, `impressions.${key}`, error);
    }
  }
  return impressions;
}

function timelineEntry(raw: unknown, field: string): TimelineEntry {
  const data = record(raw, field);
  const year = text(data.year, `${field}.year`);
  if (year === undefined) throw new Error(`${field}.year is required`);
  const entryText = text(data.text, `${field}.text`);
  if (entryText === undefined) throw new Error(`${field}.text is required`);
  return { year, text: entryText };
}

function partnerLink(raw: unknown, field: string): PartnerLink {
  const data = record(raw, field);
  const name = text(data.name, `${field}.name`);
  if (name === undefined) throw new Error(`${field}.name is required`);
  const url = httpUrl(data.url, `${field}.url`);
  if (url === undefined) throw new Error(`${field}.url is required`);
  const link: PartnerLink = { name, url };
  const description = text(data.description, `${field}.description`);
  if (description !== undefined) link.description = description;
  return link;
}
