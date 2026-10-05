/**
 * The "Standorte" singleton as `/besuch/` uses it (`src/locations.ts`), with
 * each static map resolved to an image Astro optimises at build time (as
 * `src/service-entries.ts` does).
 *
 * A map image that is not in `/src/assets/images` is left out with a
 * `console.warn`; the location itself still shows.
 */
import type { ImageMetadata } from "astro";
import raw from "./content/locations.json";
import { parseLocations, type Location } from "./locations";

// `caseSensitive: false`: see src/site-settings.ts.
const images = import.meta.glob<ImageMetadata>(
  "/src/assets/images/*.{avif,gif,jpeg,jpg,png,svg,webp}",
  { eager: true, import: "default", caseSensitive: false },
);

export interface LocationEntry {
  location: Location;
  map?: { image: ImageMetadata; alt: string; url: string };
}

export function loadLocations(): LocationEntry[] {
  return parseLocations(raw).map((location) => {
    const entry: LocationEntry = { location };
    if (location.map) {
      const image = images[location.map.image];
      if (image) {
        entry.map = { ...location.map, image };
      } else {
        console.warn(
          `Standorte: ${location.name} shows without map ${location.map.image}, it is not an image in /src/assets/images`,
        );
      }
    }
    return entry;
  });
}
