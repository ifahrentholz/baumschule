/**
 * The Seasonal offers collection as pages use it: every Markdown file in
 * `src/content/seasonal-offers/`, parsed (`src/seasonal-offers.ts`), with its
 * rendered body and its image resolved to one Astro optimises at build time,
 * the same way `src/site-settings.ts` resolves the logo.
 *
 * An offer whose image is not in `/src/assets/images` is skipped with a
 * `console.warn`, like any other invalid offer, instead of failing the build.
 */
import type { ImageMetadata, MarkdownInstance } from "astro";
import { parseSeasonalOffers, type SeasonalOffer } from "./seasonal-offers";

const files = import.meta.glob<MarkdownInstance<Record<string, unknown>>>(
  "/src/content/seasonal-offers/*.md",
  { eager: true },
);

// `caseSensitive: false`: see src/site-settings.ts.
const images = import.meta.glob<ImageMetadata>(
  "/src/assets/images/*.{avif,gif,jpeg,jpg,png,svg,webp}",
  { eager: true, import: "default", caseSensitive: false },
);

export interface SeasonalOfferEntry {
  offer: SeasonalOffer;
  Content: MarkdownInstance<Record<string, unknown>>["Content"];
  image?: ImageMetadata;
}

export function loadSeasonalOffers(): SeasonalOfferEntry[] {
  return parseSeasonalOffers(files).flatMap(({ offer, Content }) => {
    if (offer.image === undefined) return [{ offer, Content }];
    const image = images[offer.image];
    if (!image) {
      console.warn(
        `Seasonal offers: skipping ${offer.slug}, it will not show until fixed in the CMS - image ${offer.image} is not an image in /src/assets/images`,
      );
      return [];
    }
    return [{ offer, Content, image }];
  });
}
