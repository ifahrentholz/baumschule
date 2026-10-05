/**
 * The Services content as pages use it (`src/services.ts`): every service
 * with its rendered body and its images resolved to ones Astro optimises at
 * build time (as `src/assortment-entries.ts` does).
 *
 * An image that is not in `/src/assets/images` is left out with a
 * `console.warn`; the service itself still shows.
 */
import type { ImageMetadata, MarkdownInstance } from "astro";
import { parseServices, type Service } from "./services";

type ServiceFile = MarkdownInstance<Record<string, unknown>>;

const serviceFiles = import.meta.glob<ServiceFile>(
  "/src/content/services/*.md",
  { eager: true },
);

// `caseSensitive: false`: see src/site-settings.ts.
const images = import.meta.glob<ImageMetadata>(
  "/src/assets/images/*.{avif,gif,jpeg,jpg,png,svg,webp}",
  { eager: true, import: "default", caseSensitive: false },
);

export interface ServiceEntry {
  service: Service;
  Content: ServiceFile["Content"];
  /** Whether the Markdown body has any content. */
  hasBody: boolean;
  teaserImage?: ImageMetadata;
  gallery: { image: ImageMetadata; alt: string }[];
}

export function loadServices(): ServiceEntry[] {
  return parseServices(serviceFiles).map(({ service, Content, rawContent }) => {
    const entry: ServiceEntry = {
      service,
      Content,
      hasBody: rawContent().trim() !== "",
      gallery: service.gallery.flatMap(({ image, alt }) => {
        const resolved = resolveImage(service.slug, image);
        return resolved ? [{ image: resolved, alt }] : [];
      }),
    };
    if (service.teaserImage !== undefined) {
      const teaserImage = resolveImage(service.slug, service.teaserImage);
      if (teaserImage) entry.teaserImage = teaserImage;
    }
    return entry;
  });
}

function resolveImage(slug: string, path: string): ImageMetadata | undefined {
  const image = images[path];
  if (!image) {
    console.warn(
      `Services: ${slug} shows without image ${path}, it is not an image in /src/assets/images`,
    );
  }
  return image;
}
