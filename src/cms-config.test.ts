import { readdirSync, readFileSync } from "node:fs";
import type {
  CollectionFile,
  EntryCollection,
  Field,
  VariableFieldType,
} from "@sveltia/cms";
import { getFileInfo } from "prettier";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  parseAssortmentCategories,
  parseAssortmentPage,
  parseCultivarTables,
} from "./assortment";
import {
  ASSORTMENT_FILE,
  ASSORTMENT_FOLDER,
  CULTIVAR_TABLES_FOLDER,
  IMAGE_FOLDER,
  NOTICES_FOLDER,
  OPENING_HOURS_FILE,
  SEASONAL_OFFERS_FOLDER,
  SERVICES_FOLDER,
  SETTINGS_FILE,
  createCmsConfig,
} from "./cms-config";
import { ASSORTMENT_CATEGORIES, SERVICES } from "./navigation";
import { parseNotices } from "./notices";
import { parseOpeningHours, weekRows } from "./opening-hours";
import { parseSeasonalOffers } from "./seasonal-offers";
import { parseServices } from "./services";
import { parseSettings } from "./settings";

const PHASE_1_SITE = "https://ifahrentholz.de/baumschule/";

function singletons(): CollectionFile[] {
  return (createCmsConfig({ siteUrl: PHASE_1_SITE }).singletons ?? []).filter(
    (entry): entry is CollectionFile => "name" in entry,
  );
}

function singleton(name: string): CollectionFile {
  const found = singletons().find((entry) => entry.name === name);
  if (!found) throw new Error(`no ${name} singleton`);
  return found;
}

function entryCollection(name: string): EntryCollection {
  const found = createCmsConfig({ siteUrl: PHASE_1_SITE }).collections?.find(
    (entry): entry is EntryCollection =>
      "folder" in entry && entry.name === name,
  );
  if (!found) throw new Error(`no ${name} collection`);
  return found;
}

function settingsSingleton(): CollectionFile {
  return singleton("settings");
}

function fieldNames(fields: Field[]): string[] {
  return fields.map((field) => ("name" in field ? field.name : ""));
}

describe("createCmsConfig", () => {
  it("edits this repository's main branch through the GitHub API, which the CI deploys from", () => {
    expect(createCmsConfig({ siteUrl: PHASE_1_SITE }).backend).toMatchObject({
      name: "github",
      repo: "ifahrentholz/baumschule",
      branch: "main",
    });
  });

  it("offers only token sign-in in phase 1, where there is no OAuth helper", () => {
    expect(createCmsConfig({ siteUrl: PHASE_1_SITE }).backend).toMatchObject({
      auth_methods: ["token"],
    });
  });

  it("is complete on its own, so no config.yml has to be served below the base path", () => {
    const config = createCmsConfig({ siteUrl: PHASE_1_SITE });
    expect(config.load_config_file).toBe(false);
    expect(config.media_folder).toBeDefined();
  });

  it("links the UI to the site URL it is given, so it follows the base path", () => {
    const config = createCmsConfig({
      siteUrl: "https://www.baumschule-fischer.de/",
    });
    expect(config.site_url).toBe("https://www.baumschule-fischer.de/");
  });

  it("stores uploaded images in the repository folder the site resolves them from", () => {
    const config = createCmsConfig({ siteUrl: PHASE_1_SITE });
    expect(config.media_folder).toBe(IMAGE_FOLDER);
    expect(config.public_folder).toBe(`/${IMAGE_FOLDER}`);
  });

  it("edits the settings file the site reads, as JSON", () => {
    const settings = settingsSingleton();
    expect(settings.file).toBe(SETTINGS_FILE);
    expect(settings.format).toBe("json");
  });

  it("edits every Settings field the site reads", () => {
    expect(fieldNames(settingsSingleton().fields)).toEqual([
      "company_name",
      "operators",
      "address",
      "phone",
      "fax",
      "email",
      "vat_id",
      "logo",
    ]);
  });

  it("edits the opening-hours file the site reads, as JSON", () => {
    const openingHours = singleton("opening_hours");
    expect(openingHours.file).toBe(OPENING_HOURS_FILE);
    expect(openingHours.format).toBe("json");
    expect(fieldNames(openingHours.fields)).toEqual(["seasons", "exceptions"]);
  });
});

describe("the exceptions field", () => {
  // Review finding: an exception with "Geschlossen" unticked and empty
  // opens/closes could be saved and then broke the build (parseException in
  // src/opening-hours.ts). Splitting the field into two variants prevents
  // that in the CMS itself: the "open" variant is the only one with
  // opens/closes, and they stay required there.
  function exceptionTypes(): VariableFieldType[] {
    const field = singleton("opening_hours").fields.find(
      (entry): entry is Field & { name: "exceptions" } =>
        "name" in entry && entry.name === "exceptions",
    );
    if (!field || !("types" in field) || !field.types) {
      throw new Error("exceptions field has no variant types");
    }
    return field.types;
  }

  it('offers "closed" and "open with hours" variants instead of a checkbox with optional times', () => {
    expect(exceptionTypes().map((type) => type.name)).toEqual([
      "closed",
      "open",
    ]);
  });

  it('requires opens and closes in the "open" variant, so a save cannot leave them empty', () => {
    const open = exceptionTypes().find((type) => type.name === "open");
    const timeFields = fieldNames(open?.fields ?? []).filter((name) =>
      ["opens", "closes"].includes(name),
    );
    expect(timeFields).toEqual(["opens", "closes"]);
    for (const name of timeFields) {
      const field = open?.fields?.find(
        (entry) => "name" in entry && entry.name === name,
      );
      // `required` defaults to `true` when the option is absent.
      expect(field && "required" in field ? field.required : true).not.toBe(
        false,
      );
    }
  });

  it('has no opens/closes fields in the "closed" variant, so they cannot be filled in there either', () => {
    const closed = exceptionTypes().find((type) => type.name === "closed");
    expect(fieldNames(closed?.fields ?? [])).not.toContain("opens");
    expect(fieldNames(closed?.fields ?? [])).not.toContain("closes");
  });
});

describe("the files the CMS writes", () => {
  // Sveltia serialises JSON its own way (one array item per line), which
  // Prettier would reformat. A format check on these files fails CI on every
  // CMS save and so blocks the deploy.
  it("are left out of the format check, so a CMS save cannot fail CI", async () => {
    const collectionFiles = [
      "notices",
      "seasonal_offers",
      "assortment_categories",
      "cultivar_tables",
      "services",
    ].map((name) => {
      const { folder, extension } = entryCollection(name);
      return `${folder}/new-entry.${extension}`;
    });
    for (const file of [
      ...singletons().map((entry) => entry.file),
      ...collectionFiles,
    ]) {
      const { ignored } = await getFileInfo(file, {
        ignorePath: ".prettierignore",
      });
      expect(ignored, file).toBe(true);
    }
  });
});

describe("the Notices collection", () => {
  it("writes one JSON file per notice into the folder the home page reads", () => {
    const notices = entryCollection("notices");
    expect(notices.folder).toBe(NOTICES_FOLDER);
    expect(notices.format).toBe("json");
    expect(notices.extension).toBe("json");
  });

  it("edits text, link and window, with only the text required", () => {
    const { fields } = entryCollection("notices");
    expect(fieldNames(fields)).toEqual([
      "text",
      "link",
      "visible_from",
      "visible_until",
    ]);
    const optional = fields
      .filter((field) => "required" in field && field.required === false)
      .map((field) => ("name" in field ? field.name : ""));
    expect(optional).toEqual(["link", "visible_from", "visible_until"]);
  });
});

describe("the Seasonal offers collection", () => {
  it("writes one Markdown file per offer, named by its editable slug", () => {
    const offers = entryCollection("seasonal_offers");
    expect(offers.folder).toBe(SEASONAL_OFFERS_FOLDER);
    expect(offers.extension).toBe("md");
    expect(offers.slug).toMatchObject({ editable: true });
  });

  it("edits title, a required month/day window, image and body", () => {
    const { fields } = entryCollection("seasonal_offers");
    expect(fieldNames(fields)).toEqual([
      "title",
      "visible_from",
      "visible_until",
      "image",
      "body",
    ]);
    for (const name of ["visible_from", "visible_until"]) {
      const field = fields.find(
        (entry) => "name" in entry && entry.name === name,
      );
      expect(field && "required" in field ? field.required : true).not.toBe(
        false,
      );
      expect(
        fieldNames(field && "fields" in field ? (field.fields ?? []) : []),
      ).toEqual(["day", "month"]);
    }
  });
});

describe("the Assortment categories collection", () => {
  it("writes one Markdown file per category into the folder the pages read", () => {
    const categories = entryCollection("assortment_categories");
    expect(categories.folder).toBe(ASSORTMENT_FOLDER);
    expect(categories.extension).toBe("md");
  });

  // Review finding: with an editable slug, renaming, adding or deleting a
  // category in the CMS sent a navigation link (src/navigation.ts) to a 404,
  // orphaned the category's cultivar tables and turned CI red. The seven
  // categories are fixed by the page tree, so the CMS edits their content
  // only and can never change the set of slugs.
  it("cannot add, delete, duplicate or rename a category, so no save changes the set of slugs", () => {
    const categories = entryCollection("assortment_categories");
    expect(categories.create).toBe(false);
    expect(categories.delete).toBe(false);
    expect(categories.duplicate).toBe(false);
    expect(categories.slug).toBeUndefined();
  });

  it("edits title, order, teaser text and image, body, sub-groups and gallery", () => {
    const { fields } = entryCollection("assortment_categories");
    expect(fieldNames(fields)).toEqual([
      "title",
      "order",
      "teaser",
      "teaser_image",
      "body",
      "subgroups",
      "gallery",
    ]);
  });
});

describe("the Cultivar tables collection", () => {
  it("writes one JSON file per table into the folder the category pages read", () => {
    const tables = entryCollection("cultivar_tables");
    expect(tables.folder).toBe(CULTIVAR_TABLES_FOLDER);
    expect(tables.format).toBe("json");
    expect(tables.extension).toBe("json");
  });

  it("edits title, a category reference, order, group, intro, free columns and rows of cells", () => {
    const { fields } = entryCollection("cultivar_tables");
    expect(fieldNames(fields)).toEqual([
      "title",
      "category",
      "order",
      "group",
      "intro",
      "columns",
      "rows",
    ]);
    expect(
      fields.find((field) => "name" in field && field.name === "category"),
    ).toMatchObject({
      widget: "relation",
      collection: "assortment_categories",
      value_field: "{{slug}}",
    });
  });
});

describe("the Services collection", () => {
  it("writes one Markdown file per service into the folder the pages read", () => {
    const services = entryCollection("services");
    expect(services.folder).toBe(SERVICES_FOLDER);
    expect(services.extension).toBe("md");
  });

  it("cannot add, delete, duplicate or rename a service, so no save changes the set of slugs", () => {
    const services = entryCollection("services");
    expect(services.create).toBe(false);
    expect(services.delete).toBe(false);
    expect(services.duplicate).toBe(false);
    expect(services.slug).toBeUndefined();
  });

  it("edits title, order, teaser text and image, body and gallery", () => {
    const { fields } = entryCollection("services");
    expect(fieldNames(fields)).toEqual([
      "title",
      "order",
      "teaser",
      "teaser_image",
      "body",
      "gallery",
    ]);
  });
});

describe("the Assortment singleton", () => {
  it("edits the catalogue link file the overview reads, as JSON", () => {
    const assortment = singleton("assortment");
    expect(assortment.file).toBe(ASSORTMENT_FILE);
    expect(assortment.format).toBe("json");
    expect(fieldNames(assortment.fields)).toEqual(["catalogue_url"]);
  });

  // AC-14, D12: the catalogue stays external; the URL is the one the old
  // /sortiment/ page links.
  it("is committed and links the gartenmedien online catalogue", () => {
    expect(
      parseAssortmentPage(JSON.parse(readFileSync(ASSORTMENT_FILE, "utf8"))),
    ).toEqual({
      catalogueUrl:
        "https://baumschule-fischer.de.onlinekatalog.gartenmedien.de/",
    });
  });
});

describe("the committed assortment categories", () => {
  // AC-3: the seven categories of the old site, under its slugs, each
  // producing a /sortiment/<slug>/ page. Only the slugs are compared: title
  // and order are editable in the CMS, and editing them must not fail CI.
  it("are the seven categories of the navigation, all valid, each with a page", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const files = import.meta.glob<{ frontmatter: unknown }>(
      "/src/content/assortment/*.md",
      { eager: true },
    );
    const categories = parseAssortmentCategories(files).map(
      ({ category }) => category,
    );
    const navPaths = ASSORTMENT_CATEGORIES.map(({ path }) => path).sort();
    expect(
      categories.map((category) => `/sortiment/${category.slug}/`).sort(),
    ).toEqual(navPaths);
    expect(warn).not.toHaveBeenCalled();
    vi.restoreAllMocks();

    const { getStaticPaths } = await import("./pages/sortiment/[slug].astro");
    expect(
      getStaticPaths()
        .map((entry) => `/sortiment/${entry.params.slug}/`)
        .sort(),
    ).toEqual(navPaths);
  });
});

describe("the committed services", () => {
  // AC-3: the four services of the old /leistungen/ pages, under the slugs
  // of the navigation, each producing a /service/<slug>/ page, so a missing
  // or invalid file cannot silently drop a navigation target.
  it("are the four services of the navigation, all valid, each with a page", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const files = import.meta.glob<{ frontmatter: unknown }>(
      "/src/content/services/*.md",
      { eager: true },
    );
    const services = parseServices(files).map(({ service }) => service);
    const navPaths = SERVICES.map(({ path }) => path).sort();
    expect(
      services.map((service) => `/service/${service.slug}/`).sort(),
    ).toEqual(navPaths);
    expect(warn).not.toHaveBeenCalled();
    vi.restoreAllMocks();

    const { getStaticPaths } = await import("./pages/service/[slug].astro");
    expect(
      getStaticPaths()
        .map((entry) => `/service/${entry.params.slug}/`)
        .sort(),
    ).toEqual(navPaths);
  });

  // A missing image only warns at build time; the migrated photos must all
  // be there.
  it("resolve every teaser and gallery image they name", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { loadServices } = await import("./service-entries");
    for (const { service, teaserImage, gallery } of loadServices()) {
      expect(teaserImage, service.slug).toBeDefined();
      expect(gallery, service.slug).toHaveLength(service.gallery.length);
      expect(service.gallery.length, service.slug).toBeGreaterThan(0);
    }
    expect(warn).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});

describe("the committed cultivar tables", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // AC-3: the 20 cultivar tables of the old /sortiment/obstgehoelze/ page,
  // migrated read-only (titles verbatim), in the page's order.
  it("are the old Obstgehölze page's 20 tables, all valid and in its order", () => {
    const warn = vi.spyOn(console, "warn");
    const files = Object.fromEntries(
      readdirSync(CULTIVAR_TABLES_FOLDER).map((name) => [
        `${CULTIVAR_TABLES_FOLDER}/${name}`,
        JSON.parse(readFileSync(`${CULTIVAR_TABLES_FOLDER}/${name}`, "utf8")),
      ]),
    );
    const tables = parseCultivarTables(files);
    expect(tables.map((table) => table.title)).toEqual([
      "Apfel-Sortiment",
      "Befruchtungstabelle für Äpfel",
      "Birnen – Sortiment",
      "Befruchtungstabelle für Birnen",
      "Pfirsiche",
      "Aprikosen",
      "Pflaumen-Sortiment",
      "Sauerkirschen-Sortiment",
      "Neue Sorten, die weniger anfällig gegenüber Monilia sind:",
      "Süßkirschen-Sortiment",
      "Genussreifetabelle für Süßkirschen",
      "Himbeeren",
      "Kreuzung zwischen Himbeere und Brombeere",
      "Brombeeren",
      "Gartenheidelbeeren",
      "Johannisbeeren",
      "Neuere Sorten",
      "Kreuzung zwischen Johannisbeere und Stachelbeere",
      "Stachelbeeren",
      "Neuere Sorten, gelten als mehltaufester",
    ]);
    for (const table of tables) {
      expect(table.category, table.id).toBe("obstgehoelze");
      expect(table.rows.length, table.id).toBeGreaterThan(0);
    }
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("the committed notices", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // The old home page's "Zeile 00" posts (content inventory §4): the
  // Staudenmarkt notice and the teaser for the job postings.
  it("hold the old home page's notices, all valid", () => {
    const warn = vi.spyOn(console, "warn");
    const files = Object.fromEntries(
      readdirSync(NOTICES_FOLDER).map((name) => [
        `${NOTICES_FOLDER}/${name}`,
        JSON.parse(readFileSync(`${NOTICES_FOLDER}/${name}`, "utf8")),
      ]),
    );
    expect(parseNotices(files)).toEqual([
      {
        id: "staudenmarkt",
        text: "Staudenmarkt 05./06. Sept.",
        window: { kind: "dates", until: "2026-09-06" },
      },
      {
        id: "stellenanzeigen",
        text: "Stellenanzeigen",
        link: "/karriere/",
        window: { kind: "dates" },
      },
    ]);
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("the committed seasonal offers", () => {
  it("are Obstverkostung and Apfelsaft", () => {
    expect(readdirSync(SEASONAL_OFFERS_FOLDER).sort()).toEqual([
      "apfelsaft.md",
      "obstverkostung.md",
    ]);
  });

  // Owner decision (issue #7 review): both recur 1 September - 30 November.
  // Body text and image were migrated read-only from the old live pages
  // (spec D14).
  it("are valid, windowed 1 September to 30 November, and each produce a /saison/<slug>/ page", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const files = import.meta.glob<{ frontmatter: unknown }>(
      "/src/content/seasonal-offers/*.md",
      { eager: true },
    );
    const offers = parseSeasonalOffers(files).map(({ offer }) => offer);
    expect(offers.map((offer) => offer.slug)).toEqual([
      "apfelsaft",
      "obstverkostung",
    ]);
    for (const offer of offers) {
      expect(offer.window).toEqual({
        kind: "yearly",
        from: "09-01",
        until: "11-30",
      });
    }
    expect(warn).not.toHaveBeenCalled();
    vi.restoreAllMocks();

    const { getStaticPaths } = await import("./pages/saison/[slug].astro");
    expect(
      getStaticPaths()
        .map((entry) => entry.params.slug)
        .sort(),
    ).toEqual(["apfelsaft", "obstverkostung"]);
  });
});

describe("the committed settings file", () => {
  it("is valid and its logo lies in the image folder", () => {
    const settings = parseSettings(
      JSON.parse(readFileSync(SETTINGS_FILE, "utf8")),
    );
    expect(settings.logo.startsWith(`/${IMAGE_FOLDER}/`)).toBe(true);
    expect(() => readFileSync(settings.logo.slice(1))).not.toThrow();
  });
});

describe("the committed opening-hours file", () => {
  // The three season profiles of the old site (content inventory,
  // /kontakt/oeffnungszeiten-2-2/); Sunday is closed in all of them.
  it("holds the old site's season profiles", () => {
    const { seasons } = parseOpeningHours(
      JSON.parse(readFileSync(OPENING_HOURS_FILE, "utf8")),
    );
    expect(
      seasons.map((season) => ({
        name: season.name,
        months: season.months,
        week: weekRows(season),
      })),
    ).toEqual([
      {
        name: "Pflanzzeit",
        months: [3, 4, 5, 9, 10, 11],
        week: [
          { days: "Mo–Fr", hours: "7:00–18:00 Uhr" },
          { days: "Sa", hours: "9:00–14:00 Uhr" },
          { days: "So", hours: "geschlossen" },
        ],
      },
      {
        name: "Sommer",
        months: [6, 7, 8],
        week: [
          { days: "Mo–Do", hours: "7:00–16:00 Uhr" },
          { days: "Fr", hours: "7:00–13:30 Uhr" },
          { days: "Sa–So", hours: "geschlossen" },
        ],
      },
      {
        name: "Winter",
        months: [12, 1, 2],
        week: [
          { days: "Mo–Do", hours: "8:00–15:00 Uhr" },
          { days: "Fr", hours: "8:00–14:00 Uhr" },
          { days: "Sa–So", hours: "geschlossen" },
        ],
      },
    ]);
  });
});
