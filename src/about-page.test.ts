import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AboutEntry } from "./about-entries";

// Content that appears nowhere else, so it can only reach the page through
// the (mocked) "Über uns" singleton. `entry` is swapped per test.
let entry: AboutEntry;
vi.mock("./about-entries", () => ({ loadAbout: () => entry }));

const image = (await import("./assets/images/apfelsaft.jpg")).default;

function fullEntry(): AboutEntry {
  return {
    timeline: [
      { year: "Probejahr 4711", text: "Probegründung 4711" },
      { year: "Ab 4712", text: "Probeumzug 4712" },
    ],
    impressions: {
      heading: "Probeimpressionen 4711",
      intro: "Probespaziergang 4711",
      images: [{ image, alt: "Probebild 4711" }],
    },
    partners: [
      {
        name: "Probepartner 4711",
        url: "https://probe-4711.example",
        description: "Probebeschreibung 4711",
      },
      { name: "Probepartner 4712", url: "http://probe-4712.example" },
    ],
  };
}

beforeEach(() => {
  entry = fullEntry();
});

async function render(): Promise<string> {
  const container = await AstroContainer.create();
  const component = (await import("./pages/ueber-uns.astro")).default;
  return container.renderToString(component);
}

function between(html: string, start: string, end: string): string {
  const from = html.indexOf(start);
  return html.slice(from, html.indexOf(end, from));
}

describe("the page /ueber-uns/ (AC-3)", () => {
  it("shows history, impressions and links in that order", async () => {
    const html = await render();
    const order = ["Geschichte", "Probeimpressionen 4711", ">Links<"].map(
      (text) => html.indexOf(text),
    );
    expect(order.every((index) => index > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("shows the timeline as an ordered list with the year as a label", async () => {
    const html = await render();
    const timeline = between(html, '<ol class="timeline', "</ol>");
    expect(timeline).toMatch(
      /<li[^>]*><span class="year"[^>]*>Probejahr 4711<\/span><p[^>]*>Probegründung 4711<\/p><\/li>/,
    );
    expect(timeline.indexOf("Probejahr 4711")).toBeLessThan(
      timeline.indexOf("Ab 4712"),
    );
  });

  it("shows the impressions with heading, intro and a labelled gallery of described images", async () => {
    const html = await render();
    expect(html).toMatch(/<h2[^>]*>Probeimpressionen 4711<\/h2>/);
    expect(html).toContain("Probespaziergang 4711");
    const gallery = between(html, '<ul class="gallery', "</ul>");
    expect(gallery).toMatch(/aria-label="Bilder: Probeimpressionen 4711"/);
    expect(gallery).toMatch(/<img[^>]*alt="Probebild 4711"/);
    expect(gallery).toMatch(/<img[^>]*loading="lazy"/);
  });

  it('calls the gallery "Impressionen" when it has no heading', async () => {
    entry.impressions = { images: entry.impressions.images };
    const html = await render();
    expect(html).toMatch(/<h2[^>]*>Impressionen<\/h2>/);
    expect(html).toMatch(/aria-label="Bilder: Impressionen"/);
  });

  it("links every partner by name, with its description if it has one", async () => {
    const html = await render();
    const partners = between(html, '<ul class="partners', "</ul>");
    expect(partners).toMatch(
      /<a href="https:\/\/probe-4711\.example"[^>]*>Probepartner 4711<\/a>/,
    );
    expect(partners).toMatch(
      /<a href="http:\/\/probe-4712\.example"[^>]*>Probepartner 4712<\/a>/,
    );
    expect(partners).toContain("Probebeschreibung 4711");
    expect(partners.match(/<p[\s>]/g)).toHaveLength(1);
  });

  it("leaves out each section whose list is empty", async () => {
    entry = { ...fullEntry(), timeline: [], partners: [] };
    const html = await render();
    expect(html).not.toContain("Geschichte");
    expect(html).not.toContain(">Links<");
    expect(html).toContain("Probeimpressionen 4711");

    entry = { ...fullEntry(), impressions: { images: [] } };
    expect(await render()).not.toContain("Probeimpressionen 4711");
  });

  it("shows the being-rebuilt notice when all sections are empty", async () => {
    entry = { timeline: [], partners: [], impressions: { images: [] } };
    expect(await render()).toContain("wird gerade neu aufgebaut");
  });
});
