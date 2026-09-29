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
import type { CmsConfig, Field, VariableFieldType } from "@sveltia/cms";
import { MONTH_LABELS, WEEKDAY_LABELS, WEEKDAYS } from "./opening-hours";

/** Repository folder for images uploaded through the CMS. */
export const IMAGE_FOLDER = "src/assets/images";

/** Repository path of the Settings singleton, read by `src/site-settings.ts`. */
export const SETTINGS_FILE = "src/content/settings.json";

/**
 * Repository path of the Opening hours singleton, read by
 * `src/components/OpeningHours.astro`.
 */
export const OPENING_HOURS_FILE = "src/content/opening-hours.json";

const MONTH_OPTIONS = MONTH_LABELS.map((label, i) => ({
  label,
  value: i + 1,
}));

const WEEKDAY_OPTIONS = WEEKDAYS.map((value) => ({
  label: WEEKDAY_LABELS[value],
  value,
}));

/**
 * `from`/`until` fields shared by both exception variants below (see
 * `EXCEPTION_TYPES`).
 */
const EXCEPTION_DATE_FIELDS: Field[] = [
  {
    name: "from",
    label: "Datum",
    widget: "datetime",
    type: "date",
    format: "YYYY-MM-DD",
  },
  {
    name: "until",
    label: "Bis (bei mehreren Tagen)",
    widget: "datetime",
    type: "date",
    format: "YYYY-MM-DD",
    required: false,
  },
];

const EXCEPTION_NOTE_FIELD: Field = {
  name: "note",
  label: "Hinweis",
  required: false,
};

/**
 * The two shapes an exceptions list item can take, so the editor picks
 * "Geschlossen" or "Geöffnet mit Zeiten" instead of ticking a "Geschlossen"
 * box that leaves the opening/closing time fields optional either way. Only
 * the "Geöffnet mit Zeiten" variant has `opens`/`closes`, and those stay
 * required there, so a save cannot leave an "open" exception without hours
 * (see the review finding this fixes, `src/opening-hours.ts`).
 */
const EXCEPTION_TYPES: VariableFieldType[] = [
  {
    name: "closed",
    label: "Geschlossen",
    fields: [...EXCEPTION_DATE_FIELDS, EXCEPTION_NOTE_FIELD],
  },
  {
    name: "open",
    label: "Geöffnet mit Zeiten",
    fields: [
      ...EXCEPTION_DATE_FIELDS,
      {
        name: "opens",
        label: "Öffnet",
        widget: "datetime",
        type: "time",
        format: "HH:mm",
      },
      {
        name: "closes",
        label: "Schließt",
        widget: "datetime",
        type: "time",
        format: "HH:mm",
      },
      EXCEPTION_NOTE_FIELD,
    ],
  },
];

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
      {
        name: "opening_hours",
        label: "Öffnungszeiten",
        file: OPENING_HOURS_FILE,
        format: "json",
        fields: [
          {
            name: "seasons",
            label: "Saisonzeiten",
            label_singular: "Saison",
            widget: "list",
            summary: "{{fields.name}}",
            hint: "Jeder Monat gehört zu höchstens einer Saison. Tage ohne Zeiten sind geschlossen.",
            fields: [
              { name: "name", label: "Name" },
              {
                name: "months",
                label: "Monate",
                widget: "select",
                multiple: true,
                options: MONTH_OPTIONS,
              },
              {
                name: "hours",
                label: "Zeiten",
                label_singular: "Zeitfenster",
                widget: "list",
                required: false,
                summary: "{{fields.opens}}–{{fields.closes}}",
                fields: [
                  {
                    name: "days",
                    label: "Tage",
                    widget: "select",
                    multiple: true,
                    options: WEEKDAY_OPTIONS,
                  },
                  {
                    name: "opens",
                    label: "Öffnet",
                    widget: "datetime",
                    type: "time",
                    format: "HH:mm",
                  },
                  {
                    name: "closes",
                    label: "Schließt",
                    widget: "datetime",
                    type: "time",
                    format: "HH:mm",
                  },
                ],
              },
            ],
          },
          {
            name: "exceptions",
            label: "Ausnahmen",
            label_singular: "Ausnahme",
            widget: "list",
            required: false,
            summary: "{{fields.from}} {{fields.note}}",
            hint: "Eine Ausnahme ersetzt die Saisonzeiten an ihren Tagen. Überschneiden sich zwei, gilt die obere.",
            types: EXCEPTION_TYPES,
          },
        ],
      },
    ],
  };
}
