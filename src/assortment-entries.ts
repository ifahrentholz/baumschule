/**
 * The Assortment content as pages use it (`src/assortment.ts`): every
 * category with its rendered body, its images resolved to ones Astro
 * optimises at build time (as `src/seasonal-offer-entries.ts` does), and the
 * cultivar tables that refer to it.
 *
 * An image that is not in `/src/assets/images` is left out with a
 * `console.warn`; the category itself still shows. A cultivar table whose
 * category does not exist fails the build (see `tablesByCategory`).
 */
import type { ImageMetadata, MarkdownInstance } from "astro";
import raw from "./content/assortment.json";
import {
  parseAssortmentCategories,
  parseAssortmentPage,
  parseCultivarTables,
  tablesByCategory,
  type AssortmentCategory,
  type AssortmentPage,
  type CultivarTable,
} from "./assortment";

type CategoryFile = MarkdownInstance<Record<string, unknown>>;

const categoryFiles = import.meta.glob<CategoryFile>(
  "/src/content/assortment/*.md",
  { eager: true },
);

const tableFiles = import.meta.glob<unknown>(
  "/src/content/cultivar-tables/*.json",
  { eager: true, import: "default" },
);

// `caseSensitive: false`: see src/site-settings.ts.
const images = import.meta.glob<ImageMetadata>(
  "/src/assets/images/*.{avif,gif,jpeg,jpg,png,svg,webp}",
  { eager: true, import: "default", caseSensitive: false },
);

export interface AssortmentEntry {
  category: AssortmentCategory;
  Content: CategoryFile["Content"];
  /** Whether the Markdown body has any content. */
  hasBody: boolean;
  teaserImage?: ImageMetadata;
  gallery: { image: ImageMetadata; alt: string }[];
  tables: CultivarTable[];
}

export function loadAssortment(): AssortmentEntry[] {
  const entries = parseAssortmentCategories(categoryFiles);
  const tables = tablesByCategory(
    entries.map(({ category }) => category.slug),
    parseCultivarTables(tableFiles),
  );
  return entries.map(({ category, Content, rawContent }) => {
    const entry: AssortmentEntry = {
      category,
      Content,
      hasBody: rawContent().trim() !== "",
      gallery: category.gallery.flatMap(({ image, alt }) => {
        const resolved = resolveImage(category.slug, image);
        return resolved ? [{ image: resolved, alt }] : [];
      }),
      tables: tables.get(category.slug) ?? [],
    };
    if (category.teaserImage !== undefined) {
      const teaserImage = resolveImage(category.slug, category.teaserImage);
      if (teaserImage) entry.teaserImage = teaserImage;
    }
    return entry;
  });
}

export function loadAssortmentPage(): AssortmentPage {
  return parseAssortmentPage(raw);
}

function resolveImage(slug: string, path: string): ImageMetadata | undefined {
  const image = images[path];
  if (!image) {
    console.warn(
      `Assortment categories: ${slug} shows without image ${path}, it is not an image in /src/assets/images`,
    );
  }
  return image;
}
