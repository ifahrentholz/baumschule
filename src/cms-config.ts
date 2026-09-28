/**
 * Sveltia CMS configuration for the editing UI at `/admin` (see
 * `src/pages/admin/index.astro`).
 *
 * The configuration is passed to `CMS.init()` in full, so no `config.yml` is
 * served and nothing here depends on the base path: the admin page hands in
 * the site URL it is served below.
 *
 * Editors save straight to `main` (simple publish mode); every such commit
 * triggers the CI deploy. Field labels are German because the editors are;
 * field names are English, like the rest of the content model.
 */
import type { CmsConfig } from "@sveltia/cms";

/** Repository folder for images uploaded through the CMS. */
export const IMAGE_FOLDER = "src/assets/images";

/** Repository path of the Settings singleton, read by `src/site-settings.ts`. */
export const SETTINGS_FILE = "src/content/settings.json";

export interface CmsConfigOptions {
  /** Absolute URL of the site's home page, including the base path. */
  siteUrl: string;
}

export function createCmsConfig({ siteUrl }: CmsConfigOptions): CmsConfig {
  return {
    load_config_file: false,
    app_title: "Baumschule Fischer – Inhalte",
    site_url: siteUrl,
    backend: {
      name: "github",
      repo: "ifahrentholz/baumschule",
      branch: "main",
      // Phase 1 has no OAuth helper (D7): editors sign in with a GitHub
      // personal access token. Phase 2 adds `oauth` with the PHP helper (D8).
      auth_methods: ["token"],
    },
    publish_mode: "simple",
    media_folder: IMAGE_FOLDER,
    public_folder: `/${IMAGE_FOLDER}`,
    singletons: [
      {
        name: "settings",
        label: "Einstellungen",
        file: SETTINGS_FILE,
        format: "json",
        fields: [
          { name: "company_name", label: "Firmenname" },
          {
            name: "operators",
            label: "Inhaber",
            widget: "list",
            required: false,
            field: { name: "name", label: "Name" },
          },
          {
            name: "address",
            label: "Anschrift",
            widget: "object",
            fields: [
              {
                name: "street",
                label: "Straße und Hausnummer",
                required: false,
              },
              { name: "postal_code", label: "PLZ", required: false },
              { name: "city", label: "Ort", required: false },
            ],
          },
          { name: "phone", label: "Telefon", required: false },
          { name: "fax", label: "Fax", required: false },
          { name: "email", label: "E-Mail", required: false },
          { name: "vat_id", label: "USt-IdNr.", required: false },
          { name: "logo", label: "Logo", widget: "image" },
        ],
      },
    ],
  };
}
