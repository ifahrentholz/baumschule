/**
 * Field parsers shared by the CMS collections whose entries are Markdown or
 * JSON files (`src/assortment.ts`, `src/services.ts`). Each throws an `Error`
 * naming the field; the collection parser catches it and skips the entry
 * with `warnSkipped`. The CMS writes empty optional fields as empty strings;
 * those count as missing.
 */

export interface GalleryImage {
  /** Repository path of the image, e.g. `/src/assets/images/rose.jpg`. */
  image: string;
  alt: string;
}

type Data = Record<string, unknown>;

/** A slug as file names and page paths use it. */
export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The file name of a collection entry without its extension. */
export function slugOf(path: string): string {
  return (path.split("/").at(-1) ?? path).replace(/\.[^.]+$/, "");
}

export function warnSkipped(
  collection: string,
  id: string,
  error: unknown,
): void {
  const reason = error instanceof Error ? error.message : String(error);
  console.warn(
    `${collection}: skipping ${id}, it will not show until fixed in the CMS - ${reason}`,
  );
}

/** Sorts by `order`, entries without one last, then by name. */
export function byOrder(
  a: { order?: number },
  b: { order?: number },
  aName: string,
  bName: string,
): number {
  const aOrder = a.order ?? Number.POSITIVE_INFINITY;
  const bOrder = b.order ?? Number.POSITIVE_INFINITY;
  if (aOrder !== bOrder) return aOrder < bOrder ? -1 : 1;
  return aName.localeCompare(bName, "de");
}

export function galleryImage(value: unknown, field: string): GalleryImage {
  const data = record(value, field);
  const image = text(data.image, `${field}.image`);
  if (image === undefined) throw new Error(`${field}.image is required`);
  return { image, alt: text(data.alt, `${field}.alt`) ?? "" };
}

export function optionalInteger(
  value: unknown,
  field: string,
): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const number = typeof value === "string" ? Number(value) : value;
  if (typeof number !== "number" || !Number.isInteger(number)) {
    throw new Error(`${field} must be a whole number`);
  }
  return number;
}

export function list(value: unknown, field: string): unknown[] {
  if (value === undefined || value === null || value === "") return [];
  if (!Array.isArray(value)) throw new Error(`${field} must be a list`);
  return value;
}

export function record(value: unknown, field: string): Data {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${field} must be an object`);
  }
  return value as Data;
}

export function text(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw new Error(`${field} must be text`);
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}
