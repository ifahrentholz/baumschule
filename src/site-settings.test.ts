import { describe, expect, it } from "vitest";

/**
 * `import.meta.glob`'s pattern and options must be literal (Vite resolves
 * them statically at build time), so this mirrors the exact extension list
 * and `caseSensitive` option from the glob in `site-settings.ts`, pointed at
 * a small fixture directory instead of the real `src/assets/images/` — a
 * synthetic file there would otherwise show up in the CMS media library.
 */
describe("image glob (case-insensitive extensions)", () => {
  it("matches an uploaded file whose extension is upper-case, e.g. Foto.JPG", () => {
    const images = import.meta.glob(
      "/src/site-settings.fixtures/*.{avif,gif,jpeg,jpg,png,svg,webp}",
      { eager: true, caseSensitive: false },
    );
    expect(Object.keys(images)).toEqual([
      "/src/site-settings.fixtures/Foto.JPG",
    ]);
  });
});
