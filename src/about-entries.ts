/**
 * The "Über uns" singleton as `/ueber-uns/` uses it (`src/about.ts`), with
 * the impressions resolved to images Astro optimises at build time (as
 * `src/service-entries.ts` does).
 *
 * An image that is not in `/src/assets/images` is left out with a
 * `console.warn`; the rest of the gallery still shows.
 */
import type { ImageMetadata } from "astro";
import raw from "./content/about.json";
import { parseAboutPage, type PartnerLink, type TimelineEntry } from "./about";

// `caseSensitive: false`: see src/site-settings.ts.
const images = import.meta.glob<ImageMetadata>(
  "/src/assets/images/*.{avif,gif,jpeg,jpg,png,svg,webp}",
  { eager: true, import: "default", caseSensitive: false },
);

export interface AboutEntry {
  timeline: TimelineEntry[];
  partners: PartnerLink[];
  impressions: {
    heading?: string;
    intro?: string;
    images: { image: ImageMetadata; alt: string }[];
  };
}

export function loadAbout(): AboutEntry {
  const { timeline, partners, impressions } = parseAboutPage(raw);
  return {
    timeline,
    partners,
    impressions: {
      ...impressions,
      images: impressions.images.flatMap(({ image, alt }) => {
        const resolved = images[image];
        if (!resolved) {
          console.warn(
            `Über uns: skipping impression ${image}, it is not an image in /src/assets/images`,
          );
          return [];
        }
        return [{ image: resolved, alt }];
      }),
    },
  };
}
