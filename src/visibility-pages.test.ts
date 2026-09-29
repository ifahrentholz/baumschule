import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SeasonalOfferEntry } from "./seasonal-offer-entries";

// Two offers that appear nowhere else: one in its window in September, one
// only in December. The notices come from the committed seed files.
vi.mock("./seasonal-offer-entries", async () => {
  const Content = (await import("./seasonal-offers.fixtures/Body.astro"))
    .default;
  const entries: SeasonalOfferEntry[] = [
    {
      offer: {
        slug: "probesaft",
        title: "Probesaft 4711",
        from: { month: 9, day: 1 },
        until: { month: 11, day: 30 },
        window: { kind: "yearly", from: "09-01", until: "11-30" },
      },
      Content,
    },
    {
      offer: {
        slug: "probeadvent",
        title: "Probeadvent 4711",
        from: { month: 12, day: 1 },
        until: { month: 12, day: 24 },
        window: { kind: "yearly", from: "12-01", until: "12-24" },
      },
      Content,
    },
  ];
  return { loadSeasonalOffers: () => entries };
});

afterEach(() => {
  vi.useRealTimers();
});

function at(instant: string): void {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(instant));
}

async function render(page: string): Promise<string> {
  const container = await AstroContainer.create();
  const component = (await import(`./pages/${page}.astro`)).default;
  return container.renderToString(component);
}

/** The opening tag and content of the `<li>` that contains `text`. */
function item(html: string, text: string): string {
  const found = html.split("<li").find((chunk) => chunk.includes(text));
  if (!found) throw new Error(`no list item with ${text}`);
  return found;
}

function isHidden(chunk: string): boolean {
  return /^[^>]*\shidden[\s>=]/.test(chunk);
}

describe("the home page's notices (AC-5)", () => {
  it("show a notice inside its window, with its link below the base path", async () => {
    at("2026-09-05T12:00:00+02:00");
    const html = await render("index");
    expect(isHidden(item(html, "Staudenmarkt 05./06. Sept."))).toBe(false);
    const jobs = item(html, "Stellenanzeigen");
    expect(isHidden(jobs)).toBe(false);
    expect(jobs).toMatch(/href="[^"]*\/karriere\/"/);
  });

  it("leave out a notice whose window was over when the site was built", async () => {
    at("2026-09-07T00:30:00+02:00");
    const html = await render("index");
    expect(html).not.toContain("Staudenmarkt");
    expect(html).toContain("Stellenanzeigen");
  });

  it("carry their window for the client-side check", async () => {
    at("2026-09-05T12:00:00+02:00");
    const html = await render("index");
    expect(item(html, "Staudenmarkt")).toContain(
      'data-window="{&quot;kind&quot;:&quot;dates&quot;,&quot;until&quot;:&quot;2026-09-06&quot;}"',
    );
  });
});

describe("the home page's seasonal offers (AC-5)", () => {
  it("link an offer inside its window and hide one outside it", async () => {
    at("2026-09-29T12:00:00+02:00");
    const html = await render("index");
    const inWindow = item(html, "Probesaft 4711");
    expect(isHidden(inWindow)).toBe(false);
    expect(inWindow).toMatch(/href="[^"]*\/saison\/probesaft\/"/);
    expect(inWindow).toContain("1. September bis 30. November");
    const outside = item(html, "Probeadvent 4711");
    expect(isHidden(outside)).toBe(true);
    expect(outside).toContain("data-window=");
  });

  it("hide the whole section when no offer is in its window", async () => {
    at("2026-07-01T12:00:00+02:00");
    const html = await render("index");
    expect(html).toMatch(/<section[^>]*class="seasonal-offers[^>]*\shidden/);
  });
});

describe("a seasonal offer's page (AC-5)", () => {
  async function offerPage(slug: string): Promise<string> {
    const { getStaticPaths } = await import("./pages/saison/[slug].astro");
    const path = getStaticPaths().find((entry) => entry.params.slug === slug);
    if (!path) throw new Error(`no page for ${slug}`);
    const container = await AstroContainer.create();
    const page = (await import("./pages/saison/[slug].astro")).default;
    return container.renderToString(page, {
      params: path.params,
      props: path.props,
    });
  }

  it("exists for every offer, in or out of its window, so links never 404", async () => {
    const { getStaticPaths } = await import("./pages/saison/[slug].astro");
    const slugs = getStaticPaths().map((entry) => entry.params.slug);
    expect(slugs).toEqual(["probesaft", "probeadvent"]);
  });

  it("shows the offer inside its window", async () => {
    at("2026-09-29T12:00:00+02:00");
    const html = await offerPage("probesaft");
    expect(html).toContain("Probesaft 4711");
    expect(html).toMatch(/<div data-window="[^"]*"(?![^>]*hidden)[^>]*>/);
    expect(html).toContain("Probetext 4711");
    expect(html).toMatch(/<p data-outside-window="[^"]*"[^>]*hidden/);
  });

  it("outside its window hides the offer and says when it comes back", async () => {
    at("2026-09-29T12:00:00+02:00");
    const html = await offerPage("probeadvent");
    expect(html).toMatch(/<div data-window="[^"]*"[^>]*hidden/);
    expect(html).toMatch(/<p data-outside-window="[^"]*"(?![^>]*hidden)[^>]*>/);
    expect(html).toContain("Dieses Saisonangebot gibt es gerade nicht.");
    expect(html).toContain("1. Dezember bis 24. Dezember");
  });
});
