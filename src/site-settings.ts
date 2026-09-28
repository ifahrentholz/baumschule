/**
 * The Settings singleton as pages use it: parsed, with the logo resolved to
 * an image Astro optimises at build time. The CMS stores the logo as a
 * repository path (e.g. `/src/assets/images/logo.svg`), which is exactly the
 * key `import.meta.glob` uses for that file.
 */
import type { ImageMetadata } from "astro";
import raw from "./content/settings.json";
import { parseSettings, type Settings } from "./settings";

// `caseSensitive: false` makes an upload like `Foto.JPG` match too: Vite's
// glob matching is case-sensitive by default, so only lower-case extensions
// would otherwise be picked up (see src/site-settings.test.ts).
const images = import.meta.glob<ImageMetadata>(
  "/src/assets/images/*.{avif,gif,jpeg,jpg,png,svg,webp}",
  { eager: true, import: "default", caseSensitive: false },
);

export interface SiteSettings extends Settings {
  logoImage: ImageMetadata;
}

export function loadSiteSettings(): SiteSettings {
  const settings = parseSettings(raw);
  const logoImage = images[settings.logo];
  if (!logoImage) {
    throw new Error(
      `Settings: logo ${settings.logo} is not an image in /src/assets/images`,
    );
  }
  return { ...settings, logoImage };
}
