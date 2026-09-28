import { readFileSync } from "node:fs";
import type { CollectionFile, Field } from "@sveltia/cms";
import { getFileInfo } from "prettier";
import { describe, expect, it } from "vitest";
import { IMAGE_FOLDER, SETTINGS_FILE, createCmsConfig } from "./cms-config";
import { parseSettings } from "./settings";

const PHASE_1_SITE = "https://ifahrentholz.de/baumschule/";

function settingsSingleton(): CollectionFile {
  const singletons = createCmsConfig({ siteUrl: PHASE_1_SITE }).singletons;
  const settings = singletons?.find(
    (entry): entry is CollectionFile =>
      "name" in entry && entry.name === "settings",
  );
  if (!settings) throw new Error("no settings singleton");
  return settings;
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
      "brand_colors",
    ]);
  });
});

describe("the files the CMS writes", () => {
  // Sveltia serialises JSON its own way (one array item per line), which
  // Prettier would reformat. A format check on these files fails CI on every
  // CMS save and so blocks the deploy.
  it("are left out of the format check, so a CMS save cannot fail CI", async () => {
    const { ignored } = await getFileInfo(settingsSingleton().file, {
      ignorePath: ".prettierignore",
    });
    expect(ignored).toBe(true);
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
