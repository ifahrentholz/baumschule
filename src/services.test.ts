import { afterEach, describe, expect, it, vi } from "vitest";
import { parseService, parseServices } from "./services";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseService", () => {
  it("reads title, order, teaser, teaser image and gallery", () => {
    expect(
      parseService("pflanzung", {
        title: " Pflanzung ",
        order: "4",
        teaser: "Auf Wunsch pflanzen wir",
        teaser_image: "/src/assets/images/pflanzung.jpg",
        gallery: [{ image: "/src/assets/images/bagger.jpg", alt: "Bagger" }],
      }),
    ).toEqual({
      slug: "pflanzung",
      title: "Pflanzung",
      order: 4,
      teaser: "Auf Wunsch pflanzen wir",
      teaserImage: "/src/assets/images/pflanzung.jpg",
      gallery: [{ image: "/src/assets/images/bagger.jpg", alt: "Bagger" }],
    });
  });

  it("treats the CMS's empty strings as missing optional fields", () => {
    expect(
      parseService("beratung", {
        title: "Beratung",
        order: "",
        teaser: "",
        teaser_image: "",
        gallery: [{ image: "/src/assets/images/beratung.jpg", alt: "" }],
      }),
    ).toEqual({
      slug: "beratung",
      title: "Beratung",
      gallery: [{ image: "/src/assets/images/beratung.jpg", alt: "" }],
    });
  });

  it.each([
    ["beratung", {}, "title is required"],
    ["Beratung", { title: "Beratung" }, "the slug may only hold"],
    [
      "beratung",
      { title: "Beratung", order: 1.5 },
      "order must be a whole number",
    ],
    ["beratung", { title: "Beratung", teaser: 3 }, "teaser must be text"],
    ["beratung", { title: "Beratung", gallery: "x" }, "gallery must be a list"],
    [
      "beratung",
      { title: "Beratung", gallery: [{ alt: "x" }] },
      "gallery[0].image is required",
    ],
  ])("rejects %s %j", (slug, raw, message) => {
    expect(() => parseService(slug, raw)).toThrow(message);
  });
});

describe("parseServices", () => {
  it("sorts by order, services without one last, and passes the body through", () => {
    const Content = () => null;
    const entries = parseServices({
      "/src/content/services/qualitaet.md": {
        frontmatter: { title: "Qualität", order: 2 },
        Content,
      },
      "/src/content/services/gutachten.md": {
        frontmatter: { title: "Gutachten" },
        Content,
      },
      "/src/content/services/beratung.md": {
        frontmatter: { title: "Beratung", order: 1 },
        Content,
      },
    });
    expect(entries.map(({ service }) => service.slug)).toEqual([
      "beratung",
      "qualitaet",
      "gutachten",
    ]);
    expect(entries[0]?.Content).toBe(Content);
  });

  it("skips an invalid service with a warning and keeps the rest", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const entries = parseServices({
      "/src/content/services/beratung.md": {
        frontmatter: { title: "Beratung" },
      },
      "/src/content/services/kaputt.md": { frontmatter: {} },
    });
    expect(entries.map(({ service }) => service.slug)).toEqual(["beratung"]);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Services: skipping kaputt"),
    );
  });
});
