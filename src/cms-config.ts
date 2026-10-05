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
import type {
  CmsConfig,
  CollectionFile,
  EntryCollection,
  Field,
  VariableFieldType,
} from "@sveltia/cms";
import { LOCATION_ROLE_LABELS, LOCATION_ROLES } from "./locations";
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

/**
 * Repository folder of the Notices collection, one JSON file per notice,
 * read by `src/components/Notices.astro`.
 */
export const NOTICES_FOLDER = "src/content/notices";

/**
 * Repository folder of the Seasonal offers collection, one Markdown file per
 * offer, read by `src/seasonal-offer-entries.ts`.
 */
export const SEASONAL_OFFERS_FOLDER = "src/content/seasonal-offers";

/**
 * Repository folder of the Assortment categories collection, one Markdown
 * file per category, read by `src/assortment-entries.ts`.
 */
export const ASSORTMENT_FOLDER = "src/content/assortment";

/**
 * Repository folder of the Cultivar tables collection, one JSON file per
 * table, read by `src/assortment-entries.ts`.
 */
export const CULTIVAR_TABLES_FOLDER = "src/content/cultivar-tables";

/**
 * Repository folder of the Services collection, one Markdown file per
 * service, read by `src/service-entries.ts`.
 */
export const SERVICES_FOLDER = "src/content/services";

/**
 * Repository path of the Assortment singleton (the online catalogue link),
 * read by `src/assortment-entries.ts`.
 */
export const ASSORTMENT_FILE = "src/content/assortment.json";

/**
 * Repository path of the "Über uns" singleton (timeline, impressions,
 * partner links), read by `src/about-entries.ts`.
 */
export const ABOUT_FILE = "src/content/about.json";

/**
 * Repository path of the "Standorte" singleton, read by
 * `src/location-entries.ts`.
 */
export const LOCATIONS_FILE = "src/content/locations.json";

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

/** A month and a day of a seasonal offer's yearly window. */
function monthDayField(name: string, label: string): Field {
  return {
    name,
    label,
    widget: "object",
    fields: [
      {
        name: "day",
        label: "Tag",
        widget: "number",
        value_type: "int",
        min: 1,
        max: 31,
      },
      {
        name: "month",
        label: "Monat",
        widget: "select",
        options: MONTH_OPTIONS,
      },
    ],
  };
}

/** The image gallery of an assortment category, a service or "Über uns". */
const GALLERY_FIELD: Field = {
  name: "gallery",
  label: "Bildergalerie",
  label_singular: "Bild",
  widget: "list",
  required: false,
  fields: [
    { name: "image", label: "Bild", widget: "image" },
    {
      name: "alt",
      label: "Bildbeschreibung",
      required: false,
      hint: "Was auf dem Bild zu sehen ist, für Menschen, die es nicht sehen können.",
    },
  ],
};

const NOTICES: EntryCollection = {
  name: "notices",
  label: "Hinweise",
  label_singular: "Hinweis",
  description:
    "Kurze Hinweise auf der Startseite. Sie erscheinen nur zwischen „Sichtbar ab“ und „Sichtbar bis“ (jeweils einschließlich); ein leeres Feld heißt: ohne Beginn bzw. ohne Ende.",
  folder: NOTICES_FOLDER,
  extension: "json",
  format: "json",
  identifier_field: "text",
  slug: "{{uuid_short}}",
  summary: "{{fields.text}}",
  fields: [
    { name: "text", label: "Text", widget: "text" },
    {
      name: "link",
      label: "Link",
      required: false,
      hint: "Eine Seite dieser Website (z. B. /karriere/) oder eine vollständige Adresse (https://…).",
      pattern: ["^(/|https?://)", "Mit / oder https:// beginnen"],
    },
    {
      name: "visible_from",
      label: "Sichtbar ab",
      widget: "datetime",
      type: "date",
      format: "YYYY-MM-DD",
      required: false,
    },
    {
      name: "visible_until",
      label: "Sichtbar bis",
      widget: "datetime",
      type: "date",
      format: "YYYY-MM-DD",
      required: false,
    },
  ],
};

const SEASONAL_OFFERS: EntryCollection = {
  name: "seasonal_offers",
  label: "Saisonangebote",
  label_singular: "Saisonangebot",
  description:
    "Angebote wie Obstverkostung oder Apfelsaft. Jedes hat eine eigene Seite unter /saison/<Kurzname>/ und erscheint jedes Jahr zwischen „Sichtbar ab“ und „Sichtbar bis“ (jeweils einschließlich) auf der Startseite.",
  folder: SEASONAL_OFFERS_FOLDER,
  extension: "md",
  format: "yaml-frontmatter",
  slug: {
    template: "{{title}}",
    editable: true,
    hint: "Kurzname in der Adresse /saison/<Kurzname>/",
    pattern: [
      "^[a-z0-9]+(-[a-z0-9]+)*$",
      "Nur Kleinbuchstaben, Ziffern und einzelne Bindestriche",
    ],
  },
  fields: [
    { name: "title", label: "Titel" },
    monthDayField("visible_from", "Sichtbar ab"),
    monthDayField("visible_until", "Sichtbar bis"),
    { name: "image", label: "Bild", widget: "image", required: false },
    { name: "body", label: "Text", widget: "markdown", required: false },
  ],
};

const ASSORTMENT_CATEGORIES: EntryCollection = {
  name: "assortment_categories",
  label: "Sortiment",
  label_singular: "Sortimentsbereich",
  description:
    "Die sieben Sortimentsbereiche (Laubgehölze, Obstgehölze, …). Jeder hat eine eigene Seite unter /sortiment/<Kurzname>/; die Reihenfolge bestimmt die Übersicht /sortiment/. Sortentabellen werden unter „Sortentabellen“ gepflegt.",
  folder: ASSORTMENT_FOLDER,
  extension: "md",
  format: "yaml-frontmatter",
  // The seven categories are fixed by the page tree (`src/navigation.ts`),
  // and the file name is the page's slug, which cultivar tables refer to.
  // Editors change their content only: no adding, deleting or duplicating,
  // so no CMS save can break a navigation link or orphan a table.
  create: false,
  delete: false,
  duplicate: false,
  fields: [
    { name: "title", label: "Titel" },
    {
      name: "order",
      label: "Reihenfolge",
      widget: "number",
      value_type: "int",
      required: false,
      hint: "Kleinere Zahlen stehen in der Übersicht weiter vorn.",
    },
    {
      name: "teaser",
      label: "Teaser-Text",
      widget: "text",
      required: false,
    },
    {
      name: "teaser_image",
      label: "Teaser-Bild",
      widget: "image",
      required: false,
    },
    { name: "body", label: "Text", widget: "markdown", required: false },
    {
      name: "subgroups",
      label: "Untergruppen",
      label_singular: "Untergruppe",
      widget: "list",
      required: false,
      summary: "{{fields.title}}",
      fields: [
        { name: "title", label: "Titel" },
        { name: "text", label: "Text", widget: "text", required: false },
      ],
    },
    GALLERY_FIELD,
  ],
};

const CULTIVAR_TABLES: EntryCollection = {
  name: "cultivar_tables",
  label: "Sortentabellen",
  label_singular: "Sortentabelle",
  description:
    "Sortentabellen wie „Apfel-Sortiment“ oder „Befruchtungstabelle Äpfel“. Jede gehört zu einem Sortimentsbereich und erscheint auf dessen Seite. Die Spalten sind frei wählbar (z. B. Sorte, Reife, Befruchter, Geschmack); jede Zeile hat eine Zelle je Spalte, in derselben Reihenfolge.",
  folder: CULTIVAR_TABLES_FOLDER,
  extension: "json",
  format: "json",
  slug: "{{title}}",
  summary: "{{fields.title}}",
  fields: [
    { name: "title", label: "Titel" },
    {
      name: "category",
      label: "Sortimentsbereich",
      widget: "relation",
      collection: "assortment_categories",
      value_field: "{{slug}}",
      search_fields: ["title"],
      display_fields: ["title"],
    },
    {
      name: "order",
      label: "Reihenfolge",
      widget: "number",
      value_type: "int",
      required: false,
      hint: "Kleinere Zahlen stehen auf der Seite weiter oben.",
    },
    {
      name: "group",
      label: "Gruppe",
      required: false,
      hint: "Zwischenüberschrift auf der Seite, z. B. „Äpfel“. Aufeinanderfolgende Tabellen mit derselben Gruppe stehen unter einer Überschrift.",
    },
    {
      name: "intro",
      label: "Einleitung",
      widget: "text",
      required: false,
      hint: "Text über der Tabelle; Leerzeilen trennen Absätze.",
    },
    {
      name: "columns",
      label: "Spalten",
      label_singular: "Spalte",
      widget: "list",
      field: { name: "column", label: "Spaltenüberschrift" },
    },
    {
      name: "rows",
      label: "Zeilen",
      label_singular: "Zeile",
      widget: "list",
      required: false,
      fields: [
        {
          name: "cells",
          label: "Zellen",
          label_singular: "Zelle",
          widget: "list",
          hint: "Eine Zelle je Spalte, in der Reihenfolge der Spalten.",
          field: { name: "cell", label: "Inhalt", required: false },
        },
      ],
    },
  ],
};

const SERVICES: EntryCollection = {
  name: "services",
  label: "Service",
  label_singular: "Leistung",
  description:
    "Die vier Leistungen (Beratung, Qualität, Lieferservice, Pflanzung). Jede hat eine eigene Seite unter /service/<Kurzname>/; die Reihenfolge bestimmt die Übersicht /service/.",
  folder: SERVICES_FOLDER,
  extension: "md",
  format: "yaml-frontmatter",
  // Fixed by the page tree (`src/navigation.ts`) like the assortment
  // categories: no adding, deleting or duplicating, so no CMS save can break
  // a navigation link.
  create: false,
  delete: false,
  duplicate: false,
  fields: [
    { name: "title", label: "Titel" },
    {
      name: "order",
      label: "Reihenfolge",
      widget: "number",
      value_type: "int",
      required: false,
      hint: "Kleinere Zahlen stehen in der Übersicht weiter vorn.",
    },
    {
      name: "teaser",
      label: "Teaser-Text",
      widget: "text",
      required: false,
      hint: "Steht in der Übersicht /service/ und oben auf der Seite.",
    },
    {
      name: "teaser_image",
      label: "Teaser-Bild",
      widget: "image",
      required: false,
    },
    { name: "body", label: "Text", widget: "markdown", required: false },
    GALLERY_FIELD,
  ],
};

// Ordered lists in one file instead of collections: editors reorder the
// items by dragging, and none of them has a page of its own.
const ABOUT: CollectionFile = {
  name: "about",
  label: "Über uns",
  file: ABOUT_FILE,
  format: "json",
  fields: [
    {
      name: "timeline",
      label: "Geschichte",
      label_singular: "Eintrag",
      widget: "list",
      required: false,
      hint: "Die Einträge stehen auf /ueber-uns/ in der Reihenfolge dieser Liste. Ohne Einträge entfällt der Abschnitt.",
      summary: "{{fields.year}}: {{fields.text}}",
      fields: [
        {
          name: "year",
          label: "Jahr",
          hint: "Wie es auf der Seite stehen soll, z. B. „1955“, „Ende 1950er“ oder „Ab 1970“.",
        },
        { name: "text", label: "Text", widget: "text" },
      ],
    },
    {
      name: "impressions",
      label: "Impressionen",
      widget: "object",
      fields: [
        {
          name: "heading",
          label: "Überschrift",
          required: false,
          hint: "Ohne Überschrift steht dort „Impressionen“.",
        },
        { name: "intro", label: "Einleitung", widget: "text", required: false },
        { ...GALLERY_FIELD, name: "images" },
      ],
    },
    {
      name: "partners",
      label: "Links",
      label_singular: "Link",
      widget: "list",
      required: false,
      summary: "{{fields.name}}",
      fields: [
        { name: "name", label: "Name" },
        {
          name: "url",
          label: "Adresse",
          hint: "Vollständige Adresse (https://…).",
          pattern: ["^https?://", "Mit https:// oder http:// beginnen"],
        },
        {
          name: "description",
          label: "Beschreibung",
          widget: "text",
          required: false,
        },
      ],
    },
  ],
};

// An ordered list like "Über uns": /besuch/ lists the locations in this
// order, and the first sales location gets the directions and the map.
const LOCATIONS: CollectionFile = {
  name: "locations",
  label: "Standorte",
  file: LOCATIONS_FILE,
  format: "json",
  fields: [
    {
      name: "locations",
      label: "Standorte",
      label_singular: "Standort",
      widget: "list",
      required: false,
      summary: "{{fields.name}}",
      hint: "Die Standorte stehen auf /besuch/ in dieser Reihenfolge. Der erste Standort mit Verkauf bekommt dort die Anfahrt mit Karte.",
      fields: [
        { name: "name", label: "Name", hint: "Z. B. „Berlin“." },
        {
          name: "role",
          label: "Art",
          widget: "select",
          options: LOCATION_ROLES.map((value) => ({
            label: LOCATION_ROLE_LABELS[value],
            value,
          })),
        },
        {
          name: "company",
          label: "Firma",
          required: false,
          hint: "Nur wenn sie anders heißt als die Baumschule hier, z. B. die polnische Gesellschaft.",
        },
        { name: "street", label: "Straße und Hausnummer", required: false },
        { name: "postal_code", label: "PLZ", required: false },
        { name: "city", label: "Ort" },
        {
          name: "country",
          label: "Land",
          required: false,
          hint: "Nur außerhalb Deutschlands.",
        },
        { name: "phone", label: "Telefon", required: false },
        {
          name: "link",
          label: "Website",
          required: false,
          hint: "Vollständige Adresse (https://…).",
          pattern: ["^https?://", "Mit https:// oder http:// beginnen"],
        },
        {
          name: "map",
          label: "Karte",
          widget: "object",
          required: false,
          hint: "Ein Kartenbild, das auf OpenStreetMap verlinkt. Die Seite nennt darunter „Karte: © OpenStreetMap-Mitwirkende“.",
          fields: [
            { name: "image", label: "Bild", widget: "image" },
            {
              name: "alt",
              label: "Bildbeschreibung",
              hint: "Was die Karte zeigt, für Menschen, die sie nicht sehen können.",
            },
            {
              name: "url",
              label: "Adresse auf OpenStreetMap",
              hint: "Z. B. https://www.openstreetmap.org/?mlat=…&mlon=…#map=17/…/…",
              pattern: ["^https://", "Mit https:// beginnen"],
            },
          ],
        },
      ],
    },
  ],
};

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
    collections: [
      NOTICES,
      SEASONAL_OFFERS,
      ASSORTMENT_CATEGORIES,
      CULTIVAR_TABLES,
      SERVICES,
    ],
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
        name: "assortment",
        label: "Sortiment: Online-Katalog",
        file: ASSORTMENT_FILE,
        format: "json",
        fields: [
          {
            name: "catalogue_url",
            label: "Adresse des Online-Katalogs (gartenmedien)",
            required: false,
            hint: "Vollständige Adresse (https://…). Die Übersicht /sortiment/ verlinkt den Katalog; ohne Adresse entfällt der Link.",
            pattern: ["^https://", "Mit https:// beginnen"],
          },
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
      ABOUT,
      LOCATIONS,
    ],
  };
}
