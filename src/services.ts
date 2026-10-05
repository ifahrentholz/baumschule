/**
 * The Services content model, edited in Sveltia CMS (`/admin`): one Markdown
 * file per service (Beratung, Qualität, Lieferservice, Pflanzung) in
 * `src/content/services/`, front matter plus the body. The slug is the file
 * name and becomes the page `/service/<slug>/`.
 *
 * An invalid service does not fail the build: it is skipped with a
 * `console.warn` and the rest are kept, as for the assortment categories.
 * The CMS writes empty optional fields as empty strings; those count as
 * missing.
 */
import {
  byOrder,
  galleryImage,
  list,
  optionalInteger,
  record,
  SLUG,
  slugOf,
  text,
  warnSkipped,
  type GalleryImage,
} from "./content-fields";

export interface Service {
  slug: string;
  title: string;
  order?: number;
  /** Shown as the page's lead and on the overview `/service/`. */
  teaser?: string;
  /** Repository path of the teaser image. */
  teaserImage?: string;
  gallery: GalleryImage[];
}

/**
 * Services from the collection's front matter (path → front matter), valid
 * ones only, sorted by `order` (services without one last), then by slug.
 * A file may carry more (the rendered body); that is passed through untouched.
 */
export function parseServices<T>(
  files: Record<string, { frontmatter: unknown } & T>,
): (T & { service: Service })[] {
  return Object.entries(files)
    .flatMap(([path, file]) => {
      const slug = slugOf(path);
      try {
        return [{ ...file, service: parseService(slug, file.frontmatter) }];
      } catch (error) {
        warnSkipped("Services", slug, error);
        return [];
      }
    })
    .sort((a, b) =>
      byOrder(a.service, b.service, a.service.slug, b.service.slug),
    );
}

export function parseService(slug: string, raw: unknown): Service {
  if (!SLUG.test(slug)) {
    throw new Error("the slug may only hold a-z, 0-9 and single hyphens");
  }
  const data = record(raw ?? {}, "front matter");
  const title = text(data.title, "title");
  if (title === undefined) throw new Error("title is required");
  const service: Service = {
    slug,
    title,
    gallery: list(data.gallery, "gallery").map((item, i) =>
      galleryImage(item, `gallery[${i}]`),
    ),
  };
  const order = optionalInteger(data.order, "order");
  if (order !== undefined) service.order = order;
  const teaser = text(data.teaser, "teaser");
  if (teaser !== undefined) service.teaser = teaser;
  const teaserImage = text(data.teaser_image, "teaser_image");
  if (teaserImage !== undefined) service.teaserImage = teaserImage;
  return service;
}
