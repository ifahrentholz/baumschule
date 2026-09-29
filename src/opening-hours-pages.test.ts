import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Hours and notes that appear nowhere in the code or the real entry, so they
// can only reach a page through the Opening hours singleton.
vi.mock("./content/opening-hours.json", () => ({
  default: {
    seasons: [
      {
        name: "Probesaison 4711",
        months: [9, 10],
        hours: [{ days: ["mon"], opens: "06:47", closes: "11:11" }],
      },
    ],
    exceptions: [
      { type: "closed", from: "2026-09-01", note: "Schon vorbei 4711" },
      // Listed here in reverse date order, to prove the display sorts by
      // date instead of following the CMS list order (the later exception
      // comes first in this list, the earlier one second).
      {
        type: "open",
        from: "2026-11-20",
        until: "2026-11-21",
        opens: "09:00",
        closes: "10:00",
        note: "Später zuerst in der CMS-Liste 4711",
      },
      {
        type: "open",
        from: "2026-10-05",
        until: "2026-10-06",
        opens: "09:47",
        closes: "10:11",
        note: "Probeausnahme 4711",
      },
    ],
  },
}));

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-29T12:00:00+02:00"));
});

afterAll(() => {
  vi.useRealTimers();
});

async function render(page: string): Promise<string> {
  const container = await AstroContainer.create();
  const component = (await import(`./pages/${page}.astro`)).default;
  return container.renderToString(component);
}

describe.each(["index", "besuch"])("the opening hours on %s (AC-4)", (page) => {
  it("come from the Opening hours singleton", async () => {
    const html = await render(page);
    expect(html).toContain("Probesaison 4711");
    expect(html).toContain("September–Oktober");
    expect(html).toContain("6:47–11:11 Uhr");
  });

  it("list exceptions that are not over yet, with their hours and note", async () => {
    const html = await render(page);
    expect(html).toContain("5.10.2026 – 6.10.2026:");
    expect(html).toContain("9:47–10:11 Uhr");
    expect(html).toContain("Probeausnahme 4711");
    expect(html).not.toContain("Schon vorbei 4711");
  });

  it("displays exceptions sorted by date, regardless of their order in the CMS list", async () => {
    const html = await render(page);
    // Search only the visible list, not the `data-opening-hours` JSON blob
    // (which stays in the unsorted CMS/data order and contains the same
    // note text).
    const list = html.slice(html.indexOf("Abweichende Öffnungszeiten"));
    const earlier = list.indexOf("Probeausnahme 4711");
    const later = list.indexOf("Später zuerst in der CMS-Liste 4711");
    expect(earlier).toBeGreaterThan(-1);
    expect(later).toBeGreaterThan(-1);
    expect(earlier).toBeLessThan(later);
  });

  it("carry the entry for the client-side open/closed status", async () => {
    const html = await render(page);
    expect(html).toMatch(/data-opening-hours="[^"]*Probesaison 4711/);
    expect(html).toContain("data-status");
  });
});
