import { afterEach, describe, expect, it, vi } from "vitest";
import { parseLocations } from "./locations";

afterEach(() => {
  vi.restoreAllMocks();
});

const BERLIN = {
  name: " Berlin ",
  role: "sales",
  company: "Baumschulen Ewald Fischer",
  street: "Lettberger Str. 95",
  postal_code: "12355",
  city: "Berlin",
  country: "",
  phone: "+49 30 6635041",
  link: "",
  map: {
    image: "/src/assets/images/karte.jpg",
    alt: "Karte",
    url: "https://www.openstreetmap.org/?mlat=52.4&mlon=13.5#map=17/52.4/13.5",
  },
};

const WOELPINGHAUSEN = {
  name: "Wölpinghausen",
  role: "production",
  city: "Wölpinghausen",
};

describe("parseLocations", () => {
  it("reads every field, in list order, and treats the CMS's empty strings as missing", () => {
    expect(
      parseLocations({
        locations: [
          WOELPINGHAUSEN,
          {
            ...BERLIN,
            map: { image: "", alt: "", url: "" },
          },
          {
            name: "Sokolniki",
            role: "production",
            company: "Fischer Sp. z o.o.",
            street: "Sokolniki",
            postal_code: "72-130",
            city: "Maszewo",
            country: "Polen",
            link: "https://drzewkafischer.pl",
          },
        ],
      }),
    ).toEqual([
      { name: "Wölpinghausen", role: "production", city: "Wölpinghausen" },
      {
        name: "Berlin",
        role: "sales",
        company: "Baumschulen Ewald Fischer",
        street: "Lettberger Str. 95",
        postalCode: "12355",
        city: "Berlin",
        phone: "+49 30 6635041",
      },
      {
        name: "Sokolniki",
        role: "production",
        company: "Fischer Sp. z o.o.",
        street: "Sokolniki",
        postalCode: "72-130",
        city: "Maszewo",
        country: "Polen",
        link: "https://drzewkafischer.pl",
      },
    ]);
  });

  it("reads the static map", () => {
    expect(parseLocations({ locations: [BERLIN] })[0]?.map).toEqual(BERLIN.map);
  });

  it.each([
    [{ ...BERLIN, name: "" }, "locations[1].name is required"],
    [{ ...BERLIN, city: "" }, "locations[1].city is required"],
    [
      { ...BERLIN, role: "lager" },
      "locations[1].role must be one of sales, production",
    ],
    [{ ...BERLIN, role: "" }, "locations[1].role must be one of"],
    [
      { ...BERLIN, link: "drzewkafischer.pl" },
      "locations[1].link must be an http:// or https:// address",
    ],
    [
      { ...BERLIN, map: { ...BERLIN.map, url: "openstreetmap.org" } },
      "locations[1].map.url must be an http:// or https:// address",
    ],
    [
      { ...BERLIN, map: { ...BERLIN.map, image: "" } },
      "locations[1].map.image is required",
    ],
    [
      { ...BERLIN, map: { ...BERLIN.map, alt: "" } },
      "locations[1].map.alt is required",
    ],
    [
      { ...BERLIN, map: { ...BERLIN.map, url: "" } },
      "locations[1].map.url is required",
    ],
    [{ ...BERLIN, phone: 306635041 }, "locations[1].phone must be text"],
  ])(
    "skips the invalid location %j with a warning and keeps the rest",
    (location, message) => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const locations = parseLocations({
        locations: [WOELPINGHAUSEN, location, WOELPINGHAUSEN],
      });
      expect(locations.map(({ name }) => name)).toEqual([
        "Wölpinghausen",
        "Wölpinghausen",
      ]);
      expect(warn).toHaveBeenCalledOnce();
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining(`Standorte: skipping locations[1]`),
      );
      expect(warn).toHaveBeenCalledWith(expect.stringContaining(message));
    },
  );

  it("reads a broken file as no locations, with a warning instead of failing the build", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(parseLocations({})).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
    expect(parseLocations({ locations: "Berlin" })).toEqual([]);
    expect(parseLocations("kaputt")).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(2);
  });
});
