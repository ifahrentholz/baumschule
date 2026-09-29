import { afterEach, describe, expect, it, vi } from "vitest";
import {
  parseSeasonalOffer,
  parseSeasonalOffers,
  windowText,
} from "./seasonal-offers";

afterEach(() => {
  vi.restoreAllMocks();
});

const AUTUMN = {
  title: "Apfelsaft",
  visible_from: { month: 9, day: 1 },
  visible_until: { month: 11, day: 30 },
};

describe("parseSeasonalOffer", () => {
  it("reads title, image and the yearly window", () => {
    expect(
      parseSeasonalOffer("apfelsaft", {
        ...AUTUMN,
        image: "/src/assets/images/saft.jpg",
      }),
    ).toEqual({
      slug: "apfelsaft",
      title: "Apfelsaft",
      image: "/src/assets/images/saft.jpg",
      from: { month: 9, day: 1 },
      until: { month: 11, day: 30 },
      window: { kind: "yearly", from: "09-01", until: "11-30" },
    });
  });

  it("accepts month and day as numeric strings", () => {
    const offer = parseSeasonalOffer("x", {
      ...AUTUMN,
      visible_from: { month: "2", day: "29" },
    });
    expect(offer.window.from).toBe("02-29");
  });

  it.each([
    ["apfelsaft", { visible_from: AUTUMN.visible_from }, "title is required"],
    ["apfelsaft", { title: "A" }, "visible_from is required"],
    [
      "apfelsaft",
      { title: "A", visible_from: AUTUMN.visible_from, visible_until: "" },
      "visible_until is required",
    ],
    [
      "apfelsaft",
      { ...AUTUMN, visible_from: { month: 13, day: 1 } },
      "visible_from.month must be between 1 and 12",
    ],
    [
      "apfelsaft",
      { ...AUTUMN, visible_until: { month: 4, day: 31 } },
      "visible_until.day must be between 1 and 30",
    ],
    [
      "apfelsaft",
      { ...AUTUMN, visible_until: { month: 4 } },
      "visible_until.day is required",
    ],
    ["Apfel Saft", AUTUMN, "slug"],
  ])("rejects %s %j", (slug, raw, message) => {
    expect(() => parseSeasonalOffer(slug, raw)).toThrow(message);
  });
});

describe("parseSeasonalOffers", () => {
  it("skips an offer without a window with a warning and keeps the rest", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const offers = parseSeasonalOffers({
      "/src/content/seasonal-offers/apfelsaft.md": {
        frontmatter: AUTUMN,
        body: 1,
      },
      "/src/content/seasonal-offers/obstverkostung.md": {
        frontmatter: { title: "Obstverkostung" },
        body: 2,
      },
    });
    expect(offers).toHaveLength(1);
    expect(offers[0]?.offer.slug).toBe("apfelsaft");
    expect(offers[0]?.body).toBe(1);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Seasonal offers: skipping obstverkostung"),
    );
  });

  it("sorts by the start of the window", () => {
    const offers = parseSeasonalOffers({
      "/x/late.md": {
        frontmatter: { ...AUTUMN, visible_from: { month: 10, day: 1 } },
      },
      "/x/early.md": { frontmatter: AUTUMN },
    });
    expect(offers.map(({ offer }) => offer.slug)).toEqual(["early", "late"]);
  });
});

describe("windowText", () => {
  it("names the days in German", () => {
    expect(windowText(parseSeasonalOffer("x", AUTUMN))).toBe(
      "1. September bis 30. November",
    );
  });
});
