import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LocationEntry } from "./location-entries";

// Locations that appear nowhere else, so they can only reach the page
// through the (mocked) "Standorte" singleton. `entries` is swapped per test.
let entries: LocationEntry[];
vi.mock("./location-entries", () => ({ loadLocations: () => entries }));

const image = (await import("./assets/images/apfelsaft.jpg")).default;
const MAP_URL =
  "https://www.openstreetmap.org/?mlat=47.11&mlon=8.15#map=17/47.11/8.15";

// The production site comes first, so the directions must pick the sales
// site by its role, not by its position or name.
function fullEntries(): LocationEntry[] {
  return [
    {
      location: {
        name: "Probefeld 4711",
        role: "production",
        street: "Feldweg 4711",
        postalCode: "47110",
        city: "Probedorf",
        country: "Probeland",
        link: "https://probefeld-4711.example/",
      },
    },
    {
      location: {
        name: "Probeverkauf 4711",
        role: "sales",
        company: "Probefirma 4711",
        street: "Probestraße 4711",
        postalCode: "47111",
        city: "Probestadt",
        phone: "+49 (0)30 47 11",
        map: { image: "/src/assets/images/apfelsaft.jpg", alt: "", url: "" },
      },
      map: { image, alt: "Probekarte 4711", url: MAP_URL },
    },
  ];
}

beforeEach(() => {
  entries = fullEntries();
});

async function render(): Promise<string> {
  const container = await AstroContainer.create();
  const component = (await import("./pages/besuch.astro")).default;
  return container.renderToString(component);
}

function section(html: string, id: string): string {
  const start = html.indexOf(`aria-labelledby="${id}"`);
  if (start < 0) return "";
  return html.slice(start, html.indexOf("</section>", start));
}

describe("the page /besuch/", () => {
  it("shows opening hours first, then directions, then the locations", async () => {
    const html = await render();
    const order = ["oeffnungszeiten", "anfahrt", "standorte"].map((id) =>
      html.indexOf(`aria-labelledby="${id}"`),
    );
    expect(order.every((index) => index > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("gives the directions the sales location's address and a tel: link", async () => {
    const directions = section(await render(), "anfahrt");
    expect(directions).toContain("Probefirma 4711");
    expect(directions).toContain("Probestraße 4711");
    expect(directions).toContain("47111 Probestadt");
    expect(directions).toMatch(
      /<a href="tel:\+493047 ?11"[^>]*>\+49 \(0\)30 47 11<\/a>/,
    );
    expect(directions).not.toContain("Probefeld 4711");
  });

  // AC-8, spec D13: a static image that links to OpenStreetMap, with the
  // ODbL attribution as visible text, and no embedded map.
  it("shows the map as a static image linking to OpenStreetMap, with the attribution", async () => {
    const html = await render();
    const directions = section(html, "anfahrt");
    const imageLink =
      /<a href="([^"]*)"[^>]*>\s*<img[^>]*alt="Probekarte 4711"/;
    expect(imageLink.exec(directions)?.[1]).toBe(
      MAP_URL.replaceAll("&", "&amp;"),
    );
    expect(directions).toMatch(
      /Karte:\s*<a href="https:\/\/www\.openstreetmap\.org\/copyright"[^>]*>\s*© OpenStreetMap-Mitwirkende\s*<\/a>/,
    );
    expect(html).not.toMatch(/<iframe/i);
  });

  it("lists every location in order, with its role, address, country and website", async () => {
    const locations = section(await render(), "standorte");
    expect(locations.indexOf("Probefeld 4711")).toBeLessThan(
      locations.indexOf("Probeverkauf 4711"),
    );
    expect(locations).toMatch(
      /<h3[^>]*>Probefeld 4711<\/h3>\s*<p class="role"[^>]*>nur Produktion<\/p>/,
    );
    expect(locations).toMatch(
      /<h3[^>]*>Probeverkauf 4711<\/h3>\s*<p class="role"[^>]*>Verkauf<\/p>/,
    );
    expect(locations).toContain("Probeland");
    expect(locations).toMatch(
      /<a href="https:\/\/probefeld-4711\.example\/"[^>]*>probefeld-4711\.example<\/a>/,
    );
    expect(locations).toContain('href="tel:');
  });

  it("leaves out the map when it has none, and the directions without a sales location", async () => {
    const [production, sales] = fullEntries();
    if (!production || !sales) throw new Error("fixture");
    entries = [production, { location: sales.location }];
    let html = await render();
    expect(section(html, "anfahrt")).toContain("Probestraße 4711");
    expect(html).not.toContain("openstreetmap.org/copyright");

    entries = [production];
    html = await render();
    expect(html).not.toContain('aria-labelledby="anfahrt"');
    expect(section(html, "standorte")).toContain("Probefeld 4711");

    entries = [];
    html = await render();
    expect(html).not.toContain('aria-labelledby="standorte"');
    expect(html).toContain('aria-labelledby="oeffnungszeiten"');
  });
});
