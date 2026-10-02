import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssortmentEntry } from "./assortment-entries";
import type { AssortmentPage } from "./assortment";

// Two categories that appear nowhere else: one with a body, a sub-group and
// a cultivar table, one without any content yet.
const page = vi.hoisted(() => ({ value: {} as AssortmentPage }));

vi.mock("./assortment-entries", async () => {
  const Content = (await import("./seasonal-offers.fixtures/Body.astro"))
    .default;
  const entries: AssortmentEntry[] = [
    {
      category: {
        slug: "probeobst",
        title: "Probeobst 4711",
        teaser: "Teaser 4711",
        subgroups: [
          { title: "Kernobst 4711", text: "Absatz eins\n\nAbsatz zwei" },
        ],
        gallery: [],
      },
      Content,
      hasBody: true,
      gallery: [],
      tables: [
        {
          id: "probe-sortiment",
          title: "Probe-Sortiment 4711",
          category: "probeobst",
          group: "Probegruppe 4711",
          intro: "Einleitung 4711",
          columns: ["Sorte", "Reife", "Befruchter"],
          rows: [
            ["Boskoop", "Oktober", "Cox Orange"],
            ["Elstar", "September", ""],
          ],
        },
      ],
    },
    {
      category: {
        slug: "probeleer",
        title: "Probeleer 4711",
        subgroups: [],
        gallery: [],
      },
      Content,
      hasBody: false,
      gallery: [],
      tables: [],
    },
  ];
  return {
    loadAssortment: () => entries,
    loadAssortmentPage: () => page.value,
  };
});

beforeEach(() => {
  page.value = {};
});

async function render(name: string, options = {}): Promise<string> {
  const container = await AstroContainer.create();
  const component = (await import(`./pages/sortiment/${name}.astro`)).default;
  return container.renderToString(component, options);
}

async function categoryPage(slug: string): Promise<string> {
  const { getStaticPaths } = await import("./pages/sortiment/[slug].astro");
  const path = getStaticPaths().find((entry) => entry.params.slug === slug);
  if (!path) throw new Error(`no page for ${slug}`);
  return render("[slug]", { params: path.params, props: path.props });
}

describe("the assortment overview /sortiment/", () => {
  it("links the gartenmedien online catalogue prominently (AC-14, D12)", async () => {
    page.value = { catalogueUrl: "https://katalog.example.de/fischer" };
    const html = await render("index");
    expect(html).toMatch(
      /<aside[^>]*class="catalogue[^"]*"[^>]*>[\s\S]*href="https:\/\/katalog\.example\.de\/fischer"/,
    );
    expect(html.indexOf("Online-Katalog")).toBeLessThan(
      html.indexOf("Probeobst 4711"),
    );
  });

  it("shows no catalogue block while no catalogue URL is set", async () => {
    const html = await render("index");
    expect(html).not.toContain('class="catalogue');
  });

  it("lists every category in order, linked below the base path, with its teaser", async () => {
    const html = await render("index");
    expect(html.indexOf("Probeobst 4711")).toBeLessThan(
      html.indexOf("Probeleer 4711"),
    );
    expect(html).toMatch(/href="[^"]*\/sortiment\/probeobst\/"/);
    expect(html).toMatch(/href="[^"]*\/sortiment\/probeleer\/"/);
    expect(html).toContain("Teaser 4711");
  });
});

describe("an assortment category page /sortiment/<slug>/ (AC-3)", () => {
  it("exists for every category", async () => {
    const { getStaticPaths } = await import("./pages/sortiment/[slug].astro");
    expect(getStaticPaths().map((entry) => entry.params.slug)).toEqual([
      "probeobst",
      "probeleer",
    ]);
  });

  it("shows the title, teaser, body and sub-groups", async () => {
    const html = await categoryPage("probeobst");
    expect(html).toMatch(/<h1[^>]*>Probeobst 4711<\/h1>/);
    expect(html).toContain("Teaser 4711");
    expect(html).toContain("Probetext 4711");
    expect(html).toMatch(/<h2[^>]*>Kernobst 4711<\/h2>/);
    expect(html).toMatch(/<p[^>]*>Absatz eins<\/p>/);
    expect(html).toMatch(/<p[^>]*>Absatz zwei<\/p>/);
    expect(html).not.toContain("wird gerade neu aufgebaut");
  });

  it("renders its cultivar tables with their own columns and one row per cultivar", async () => {
    const html = await categoryPage("probeobst");
    expect(html).toContain("Probe-Sortiment 4711");
    const table = html.slice(html.indexOf("<table"), html.indexOf("</table>"));
    expect(table.match(/<th[^>]*scope="col"[^>]*>([^<]*)</g)).toHaveLength(3);
    expect(table).toMatch(/<th[^>]*scope="col"[^>]*>Befruchter</);
    expect(table).toMatch(/<th[^>]*scope="row"[^>]*>Boskoop</);
    expect(table).toMatch(/<td[^>]*>Cox Orange</);
    expect(table.match(/<tr/g)).toHaveLength(3);
  });

  it("shows a table's group as a heading above it, and its intro", async () => {
    const html = await categoryPage("probeobst");
    expect(html).toMatch(/<h3[^>]*>Probegruppe 4711<\/h3>/);
    expect(html).toMatch(/<h4[^>]*>Probe-Sortiment 4711<\/h4>/);
    expect(html).toMatch(/<p[^>]*>Einleitung 4711<\/p>/);
    expect(html.indexOf("Probegruppe 4711")).toBeLessThan(
      html.indexOf("Einleitung 4711"),
    );
  });

  it("shows the being-rebuilt notice for a category without content", async () => {
    const html = await categoryPage("probeleer");
    expect(html).toMatch(/<h1[^>]*>Probeleer 4711<\/h1>/);
    expect(html).toContain("wird gerade neu aufgebaut");
    expect(html).not.toContain("<table");
  });
});
