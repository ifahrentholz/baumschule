/**
 * The Assortment content model, edited in Sveltia CMS (`/admin`):
 *
 * - Assortment categories (Laubgehölze, Obstgehölze, ...): one Markdown file
 *   per category in `src/content/assortment/` (front matter plus the body).
 *   The slug is the file name and becomes the page `/sortiment/<slug>/`.
 * - Cultivar tables (Apfel-Sortiment, Befruchtungstabelle Äpfel, ...): one
 *   JSON file per table in `src/content/cultivar-tables/`. A table refers to
 *   its category by slug and has its own columns, because they differ per
 *   fruit type (ripeness, pollinator, taste, ...).
 * - The Assortment singleton (`src/content/assortment.json`): the link to
 *   the external gartenmedien online catalogue (spec D12).
 *
 * An invalid category or table does not fail the build: it is skipped with a
 * `console.warn` and the rest are kept, as for the seasonal offers. The CMS
 * writes empty optional fields as empty strings; those count as missing.
 */

export interface Subgroup {
  title: string;
  /** Plain text; blank lines separate paragraphs. */
  text?: string;
}

export interface GalleryImage {
  /** Repository path of the image, e.g. `/src/assets/images/rose.jpg`. */
  image: string;
  alt: string;
}

export interface AssortmentCategory {
  slug: string;
  title: string;
  order?: number;
  teaser?: string;
  /** Repository path of the teaser image. */
  teaserImage?: string;
  subgroups: Subgroup[];
  gallery: GalleryImage[];
}

export interface CultivarTable {
  /** File name without extension, e.g. `apfel-sortiment`. */
  id: string;
  title: string;
  /** Slug of the assortment category the table belongs to. */
  category: string;
  order?: number;
  /**
   * Heading the table is shown under on the category page, e.g. `Äpfel`;
   * consecutive tables with the same group share it.
   */
  group?: string;
  /** Plain text above the table; blank lines separate paragraphs. */
  intro?: string;
  columns: string[];
  /** One entry per row, each with exactly one cell per column. */
  rows: string[][];
}

export interface AssortmentPage {
  /** Absolute `https` URL of the gartenmedien online catalogue. */
  catalogueUrl?: string;
}

type Data = Record<string, unknown>;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Categories from the collection's front matter (path → front matter), valid
 * ones only, sorted by `order` (categories without one last), then by slug.
 * A file may carry more (the rendered body); that is passed through untouched.
 */
export function parseAssortmentCategories<T>(
  files: Record<string, { frontmatter: unknown } & T>,
): (T & { category: AssortmentCategory })[] {
  return Object.entries(files)
    .flatMap(([path, file]) => {
      const slug = slugOf(path);
      try {
        const category = parseAssortmentCategory(slug, file.frontmatter);
        return [{ ...file, category }];
      } catch (error) {
        warnSkipped("Assortment categories", slug, error);
        return [];
      }
    })
    .sort((a, b) =>
      byOrder(a.category, b.category, a.category.slug, b.category.slug),
    );
}

export function parseAssortmentCategory(
  slug: string,
  raw: unknown,
): AssortmentCategory {
  if (!SLUG.test(slug)) {
    throw new Error("the slug may only hold a-z, 0-9 and single hyphens");
  }
  const data = record(raw ?? {}, "front matter");
  const title = text(data.title, "title");
  if (title === undefined) throw new Error("title is required");
  const category: AssortmentCategory = {
    slug,
    title,
    subgroups: list(data.subgroups, "subgroups").map((item, i) =>
      subgroup(item, `subgroups[${i}]`),
    ),
    gallery: list(data.gallery, "gallery").map((item, i) =>
      galleryImage(item, `gallery[${i}]`),
    ),
  };
  const order = optionalInteger(data.order, "order");
  if (order !== undefined) category.order = order;
  const teaser = text(data.teaser, "teaser");
  if (teaser !== undefined) category.teaser = teaser;
  const teaserImage = text(data.teaser_image, "teaser_image");
  if (teaserImage !== undefined) category.teaserImage = teaserImage;
  return category;
}

/**
 * Cultivar tables from the collection's files (path → parsed JSON), valid
 * ones only, sorted by `order` (tables without one last), then by title.
 */
export function parseCultivarTables(
  files: Record<string, unknown>,
): CultivarTable[] {
  return Object.entries(files)
    .flatMap(([path, raw]) => {
      const id = slugOf(path);
      try {
        return [parseCultivarTable(id, raw)];
      } catch (error) {
        warnSkipped("Cultivar tables", id, error);
        return [];
      }
    })
    .sort((a, b) => byOrder(a, b, a.title, b.title));
}

export function parseCultivarTable(id: string, raw: unknown): CultivarTable {
  const data = record(raw ?? {}, "table");
  const title = text(data.title, "title");
  if (title === undefined) throw new Error("title is required");
  const category = text(data.category, "category");
  if (category === undefined) throw new Error("category is required");
  const columns = list(data.columns, "columns").map(
    (column, i) => text(column, `columns[${i}]`) ?? "",
  );
  if (columns.length === 0) {
    throw new Error("columns needs at least one column");
  }
  const rows = list(data.rows, "rows").map((item, i) => {
    const field = `rows[${i}]`;
    const cells = list(record(item, field).cells, `${field}.cells`).map(
      (cell, j) => cellText(cell, `${field}.cells[${j}]`),
    );
    if (cells.length > columns.length) {
      throw new Error(
        `${field} has ${cells.length} cells but the table has ${columns.length} columns`,
      );
    }
    // The CMS may drop trailing empty cells; they stay empty.
    return [...cells, ...Array<string>(columns.length - cells.length).fill("")];
  });
  const table: CultivarTable = { id, title, category, columns, rows };
  const order = optionalInteger(data.order, "order");
  if (order !== undefined) table.order = order;
  const group = text(data.group, "group");
  if (group !== undefined) table.group = group;
  const intro = text(data.intro, "intro");
  if (intro !== undefined) table.intro = intro;
  return table;
}

/**
 * The Assortment singleton. An invalid catalogue URL is dropped with a
 * `console.warn` (the page then shows no catalogue link) instead of failing
 * the build.
 */
export function parseAssortmentPage(raw: unknown): AssortmentPage {
  const page: AssortmentPage = {};
  try {
    const data = record(raw ?? {}, "assortment");
    const url = text(data.catalogue_url, "catalogue_url");
    if (url === undefined) return page;
    if (!/^https:\/\/[^\s/]+\.[^\s/]+/.test(url)) {
      throw new Error("catalogue_url must be an https:// address");
    }
    page.catalogueUrl = url;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(
      `Assortment: the catalogue link will not show until fixed in the CMS - ${reason}`,
    );
  }
  return page;
}

/**
 * The tables of each category (category slug → its tables, in order). A
 * table that refers to a category that does not exist fails the build:
 * skipping it would silently drop it, and a category rename would drop all
 * of that category's tables at once.
 */
export function tablesByCategory(
  categorySlugs: string[],
  tables: CultivarTable[],
): Map<string, CultivarTable[]> {
  const byCategory = new Map(
    categorySlugs.map((slug) => [slug, [] as CultivarTable[]]),
  );
  const unknown = tables.filter((table) => !byCategory.has(table.category));
  if (unknown.length > 0) {
    const list = unknown
      .map((table) => `${table.id} (category "${table.category}")`)
      .join(", ");
    throw new Error(
      `Cultivar tables: ${list} refer to a category that does not exist or is invalid (see any warnings above). Fix the table's category or the category file.`,
    );
  }
  for (const table of tables) byCategory.get(table.category)!.push(table);
  return byCategory;
}

/**
 * Tables in runs of the same `group`, in their order, so each group's
 * heading is shown once above its tables.
 */
export function groupTables(
  tables: CultivarTable[],
): { group?: string; tables: CultivarTable[] }[] {
  const runs: { group?: string; tables: CultivarTable[] }[] = [];
  for (const table of tables) {
    const last = runs.at(-1);
    if (last && last.group === table.group) {
      last.tables.push(table);
    } else {
      runs.push(
        table.group === undefined
          ? { tables: [table] }
          : { group: table.group, tables: [table] },
      );
    }
  }
  return runs;
}

/** A text's paragraphs (split at blank lines). */
export function paragraphs(value: string | undefined): string[] {
  return (value ?? "")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== "");
}

function subgroup(value: unknown, field: string): Subgroup {
  const data = record(value, field);
  const title = text(data.title, `${field}.title`);
  if (title === undefined) throw new Error(`${field}.title is required`);
  const result: Subgroup = { title };
  const body = text(data.text, `${field}.text`);
  if (body !== undefined) result.text = body;
  return result;
}

function galleryImage(value: unknown, field: string): GalleryImage {
  const data = record(value, field);
  const image = text(data.image, `${field}.image`);
  if (image === undefined) throw new Error(`${field}.image is required`);
  return { image, alt: text(data.alt, `${field}.alt`) ?? "" };
}

function byOrder(
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

function warnSkipped(collection: string, id: string, error: unknown): void {
  const reason = error instanceof Error ? error.message : String(error);
  console.warn(
    `${collection}: skipping ${id}, it will not show until fixed in the CMS - ${reason}`,
  );
}

function slugOf(path: string): string {
  return (path.split("/").at(-1) ?? path).replace(/\.[^.]+$/, "");
}

function optionalInteger(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const number = typeof value === "string" ? Number(value) : value;
  if (typeof number !== "number" || !Number.isInteger(number)) {
    throw new Error(`${field} must be a whole number`);
  }
  return number;
}

function list(value: unknown, field: string): unknown[] {
  if (value === undefined || value === null || value === "") return [];
  if (!Array.isArray(value)) throw new Error(`${field} must be a list`);
  return value;
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

/** A table cell: text, or a number the YAML/JSON reader turned into one. */
function cellText(value: unknown, field: string): string {
  if (typeof value === "number") return String(value);
  return text(value, field) ?? "";
}
