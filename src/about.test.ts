import { afterEach, describe, expect, it, vi } from "vitest";
import { parseAboutPage } from "./about";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseAboutPage", () => {
  it("reads timeline, impressions and partners in list order", () => {
    expect(
      parseAboutPage({
        timeline: [
          { year: " Ende 1950er ", text: "Umzug" },
          { year: "1955", text: "Gründung" },
        ],
        impressions: {
          heading: "Wir freuen uns auf Sie!",
          intro: "Spaziergang",
          images: [{ image: "/src/assets/images/weg.jpg", alt: "Weg" }],
        },
        partners: [
          {
            name: "Baum des Jahres",
            url: "https://baum-des-jahres.de",
            description: "Jedes Jahr ein Baum",
          },
        ],
      }),
    ).toEqual({
      timeline: [
        { year: "Ende 1950er", text: "Umzug" },
        { year: "1955", text: "Gründung" },
      ],
      impressions: {
        heading: "Wir freuen uns auf Sie!",
        intro: "Spaziergang",
        images: [{ image: "/src/assets/images/weg.jpg", alt: "Weg" }],
      },
      partners: [
        {
          name: "Baum des Jahres",
          url: "https://baum-des-jahres.de",
          description: "Jedes Jahr ein Baum",
        },
      ],
    });
  });

  it("treats the CMS's empty strings as missing optional fields", () => {
    expect(
      parseAboutPage({
        timeline: [],
        impressions: { heading: "", intro: "", images: [] },
        partners: [
          { name: "Gabot", url: "http://www.gabot.de", description: "" },
        ],
      }),
    ).toEqual({
      timeline: [],
      impressions: { images: [] },
      partners: [{ name: "Gabot", url: "http://www.gabot.de" }],
    });
  });

  it("reads a missing or empty file as an empty page", () => {
    const empty = { timeline: [], partners: [], impressions: { images: [] } };
    expect(parseAboutPage({})).toEqual(empty);
    expect(parseAboutPage(undefined)).toEqual(empty);
  });

  it.each([
    [
      "timeline",
      { year: "", text: "Gründung" },
      "timeline[1].year is required",
    ],
    ["timeline", { year: "1955" }, "timeline[1].text is required"],
    ["partners", { url: "https://gabot.de" }, "partners[1].name is required"],
    ["partners", { name: "Gabot", url: "" }, "partners[1].url is required"],
    [
      "partners",
      { name: "Gabot", url: "www.gabot.de" },
      "partners[1].url must be an http:// or https:// address",
    ],
    [
      "partners",
      { name: "Gabot", url: "javascript:alert(1)" },
      "partners[1].url must be an http:// or https:// address",
    ],
  ])(
    "skips an invalid %s item %j with a warning and keeps the rest",
    (list, item, message) => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const valid =
        list === "timeline"
          ? { year: "1982", text: "Übernahme" }
          : { name: "Bundessortenamt", url: "https://www.bundessortenamt.de" };
      const page = parseAboutPage({ [list]: [valid, item, valid] });
      expect(page[list as "timeline" | "partners"]).toEqual([valid, valid]);
      expect(warn).toHaveBeenCalledOnce();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining(message));
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("Über uns: skipping"),
      );
    },
  );

  it("skips an impression without an image and keeps the rest", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const image = { image: "/src/assets/images/weg.jpg", alt: "" };
    expect(
      parseAboutPage({ impressions: { images: [image, { alt: "x" }] } })
        .impressions.images,
    ).toEqual([image]);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("impressions.images[1].image is required"),
    );
  });

  it("drops a broken list or text with a warning instead of failing the build", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(
      parseAboutPage({
        timeline: "1955",
        impressions: { heading: 3, images: [] },
        partners: [{ name: "Gabot", url: "https://www.gabot.de" }],
      }),
    ).toEqual({
      timeline: [],
      impressions: { images: [] },
      partners: [{ name: "Gabot", url: "https://www.gabot.de" }],
    });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("timeline must be a list"),
    );
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("impressions.heading must be text"),
    );
    expect(() => parseAboutPage("kaputt")).not.toThrow();
  });
});
