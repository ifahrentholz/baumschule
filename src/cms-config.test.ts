import { readFileSync } from "node:fs";
import type { CollectionFile, Field, VariableFieldType } from "@sveltia/cms";
import { getFileInfo } from "prettier";
import { describe, expect, it } from "vitest";
import {
  IMAGE_FOLDER,
  OPENING_HOURS_FILE,
  SETTINGS_FILE,
  createCmsConfig,
} from "./cms-config";
import { parseOpeningHours, weekRows } from "./opening-hours";
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
    for (const { file } of singletons()) {
      const { ignored } = await getFileInfo(file, {
        ignorePath: ".prettierignore",
      });
      expect(ignored, file).toBe(true);
    }
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
