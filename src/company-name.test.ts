import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it, vi } from "vitest";

// A name that appears nowhere in the code or the real settings, so it can
// only reach the page through the Settings singleton.
const TEST_NAME = "Probe Nursery 4711";

vi.mock("./site-settings", async (importOriginal) => {
  const original = await importOriginal<typeof import("./site-settings")>();
  return {
    loadSiteSettings: () => ({
      ...original.loadSiteSettings(),
      company_name: TEST_NAME,
    }),
  };
});

async function render(page: string): Promise<string> {
  const container = await AstroContainer.create();
  const component = (await import(`./pages/${page}.astro`)).default;
  return container.renderToString(component);
}

function textOf(html: string, tag: string): string | undefined {
  return new RegExp(`<${tag}\\b[^>]*>([^<]*)</${tag}>`).exec(html)?.[1];
}

describe("the company name from Settings (company_name)", () => {
  it("is the home page's <title> and <h1>", async () => {
    const html = await render("index");
    expect(textOf(html, "title")).toBe(TEST_NAME);
    expect(textOf(html, "h1")).toBe(TEST_NAME);
  });

  it("ends every other page's <title>", async () => {
    const html = await render("kontakt");
    expect(textOf(html, "title")).toBe(`Kontakt – ${TEST_NAME}`);
  });
});
