import { afterEach, describe, expect, it, vi } from "vitest";
import {
  groupTables,
  paragraphs,
  parseAssortmentCategories,
  parseAssortmentCategory,
  parseAssortmentPage,
  parseCultivarTable,
  parseCultivarTables,
  tablesByCategory,
} from "./assortment";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseAssortmentCategory", () => {
  it("reads title, order, teaser, sub-groups and gallery", () => {
    expect(
      parseAssortmentCategory("obstgehoelze", {
        title: " Obstgehölze ",
        order: "3",
        teaser: "Äpfel, Birnen und Beerenobst",
        teaser_image: "/src/assets/images/apfel.jpg",
        subgroups: [{ title: "Kernobst", text: "Äpfel\n\nBirnen" }],
        gallery: [{ image: "/src/assets/images/birne.jpg", alt: "Birne" }],
      }),
    ).toEqual({
      slug: "obstgehoelze",
      title: "Obstgehölze",
      order: 3,
      teaser: "Äpfel, Birnen und Beerenobst",
      teaserImage: "/src/assets/images/apfel.jpg",
      subgroups: [{ title: "Kernobst", text: "Äpfel\n\nBirnen" }],
      gallery: [{ image: "/src/assets/images/birne.jpg", alt: "Birne" }],
    });
  });

  it("treats the CMS's empty strings as missing optional fields", () => {
    expect(
      parseAssortmentCategory("rosen", {
        title: "Rosen",
        order: "",
        teaser: "",
        teaser_image: "",
        subgroups: [{ title: "Edelrosen", text: "" }],
        gallery: [{ image: "/src/assets/images/rose.jpg", alt: "" }],
      }),
    ).toEqual({
      slug: "rosen",
      title: "Rosen",
      subgroups: [{ title: "Edelrosen" }],
      gallery: [{ image: "/src/assets/images/rose.jpg", alt: "" }],
    });
  });

  it.each([
    ["rosen", {}, "title is required"],
    ["Rosen", { title: "Rosen" }, "the slug may only hold"],
    ["rosen", { title: "Rosen", order: 1.5 }, "order must be a whole number"],
    ["rosen", { title: "Rosen", subgroups: "x" }, "subgroups must be a list"],
    [
      "rosen",
      { title: "Rosen", subgroups: [{ text: "x" }] },
      "subgroups[0].title is required",
    ],
    [
      "rosen",
      { title: "Rosen", gallery: [{ alt: "x" }] },
      "gallery[0].image is required",
    ],
  ])("rejects %s %j", (slug, raw, message) => {
    expect(() => parseAssortmentCategory(slug, raw)).toThrow(message);
  });
});

describe("parseAssortmentCategories", () => {
  it("sorts by order, categories without one last, and passes the body through", () => {
    const Content = () => null;
    const entries = parseAssortmentCategories({
      "/src/content/assortment/rosen.md": {
        frontmatter: { title: "Rosen", order: 6 },
        Content,
      },
      "/src/content/assortment/zierobst.md": {
        frontmatter: { title: "Zierobst" },
        Content,
      },
      "/src/content/assortment/laubgehoelze.md": {
        frontmatter: { title: "Laubgehölze", order: 1 },
        Content,
      },
    });
    expect(entries.map(({ category }) => category.slug)).toEqual([
      "laubgehoelze",
      "rosen",
      "zierobst",
    ]);
    expect(entries[0]?.Content).toBe(Content);
  });

  it("skips an invalid category with a warning and keeps the rest", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const entries = parseAssortmentCategories({
      "/src/content/assortment/rosen.md": { frontmatter: { title: "Rosen" } },
      "/src/content/assortment/kaputt.md": { frontmatter: {} },
    });
    expect(entries.map(({ category }) => category.slug)).toEqual(["rosen"]);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("skipping kaputt"),
    );
  });
});

const APPLES = {
  title: "Apfel-Sortiment",
  category: "obstgehoelze",
  order: 1,
  columns: ["Sorte", "Reife", "Geschmack"],
  rows: [
    { cells: ["Boskoop", "Oktober", "säuerlich"] },
    { cells: ["Elstar", "September"] },
  ],
};

describe("parseCultivarTable", () => {
  it("reads title, category, its own columns and the rows, padding short rows", () => {
    expect(parseCultivarTable("apfel-sortiment", APPLES)).toEqual({
      id: "apfel-sortiment",
      title: "Apfel-Sortiment",
      category: "obstgehoelze",
      order: 1,
      columns: ["Sorte", "Reife", "Geschmack"],
      rows: [
        ["Boskoop", "Oktober", "säuerlich"],
        ["Elstar", "September", ""],
      ],
    });
  });

  it("allows a table of any width, e.g. a pollination table", () => {
    const table = parseCultivarTable("befruchtung", {
      title: "Befruchtungstabelle Äpfel",
      category: "obstgehoelze",
      columns: ["Sorte", "Befruchter"],
      rows: [{ cells: ["Elstar", "Gala, Jonagold"] }],
    });
    expect(table.columns).toHaveLength(2);
    expect(table.rows).toEqual([["Elstar", "Gala, Jonagold"]]);
  });

  it("reads an optional group and intro", () => {
    const table = parseCultivarTable("pfirsiche", {
      ...APPLES,
      group: "Pfirsiche und Aprikosen",
      intro: "Der Pfirsich ist sehr wärmebedürftig.",
    });
    expect(table.group).toBe("Pfirsiche und Aprikosen");
    expect(table.intro).toBe("Der Pfirsich ist sehr wärmebedürftig.");
    const plain = parseCultivarTable("x", { ...APPLES, group: "", intro: "" });
    expect(plain).not.toHaveProperty("group");
    expect(plain).not.toHaveProperty("intro");
  });

  it("keeps numbers as cell text", () => {
    const table = parseCultivarTable("x", {
      ...APPLES,
      rows: [{ cells: ["Boskoop", 10, ""] }],
    });
    expect(table.rows).toEqual([["Boskoop", "10", ""]]);
  });

  it.each([
    [{ ...APPLES, title: "" }, "title is required"],
    [{ ...APPLES, category: undefined }, "category is required"],
    [{ ...APPLES, columns: [] }, "columns needs at least one column"],
    [
      { ...APPLES, rows: [{ cells: ["a", "b", "c", "d"] }] },
      "rows[0] has 4 cells but the table has 3 columns",
    ],
    [{ ...APPLES, rows: [{ cells: "a" }] }, "rows[0].cells must be a list"],
  ])("rejects %j", (raw, message) => {
    expect(() => parseCultivarTable("x", raw)).toThrow(message);
  });
});

describe("parseCultivarTables", () => {
  it("sorts by order, then title, and skips an invalid table with a warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const tables = parseCultivarTables({
      "/src/content/cultivar-tables/pflaumen.json": {
        ...APPLES,
        title: "Pflaumen",
        order: undefined,
      },
      "/src/content/cultivar-tables/birnen.json": {
        ...APPLES,
        title: "Birnen",
        order: 2,
      },
      "/src/content/cultivar-tables/apfel.json": APPLES,
      "/src/content/cultivar-tables/kaputt.json": { title: "Kaputt" },
    });
    expect(tables.map((table) => table.id)).toEqual([
      "apfel",
      "birnen",
      "pflaumen",
    ]);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("skipping kaputt"),
    );
  });
});

describe("tablesByCategory", () => {
  const table = (id: string, category: string) =>
    parseCultivarTable(id, { ...APPLES, category });

  it("hands each category its tables, in order, and an empty list to the rest", () => {
    const byCategory = tablesByCategory(
      ["obstgehoelze", "rosen"],
      [table("a", "obstgehoelze"), table("b", "obstgehoelze")],
    );
    expect(byCategory.get("obstgehoelze")?.map((t) => t.id)).toEqual([
      "a",
      "b",
    ]);
    expect(byCategory.get("rosen")).toEqual([]);
  });

  // Review finding: a table whose category was renamed used to drop out of
  // the build with only a console.warn; for Obstgehölze, all 20 at once.
  it("fails the build, naming every table, when a table's category does not exist", () => {
    expect(() =>
      tablesByCategory(
        ["obst"],
        [
          table("apfel", "obstgehoelze"),
          table("birne", "obstgehoelze"),
          table("rose", "obst"),
        ],
      ),
    ).toThrow(
      'apfel (category "obstgehoelze"), birne (category "obstgehoelze") refer to a category that does not exist',
    );
  });
});

describe("groupTables", () => {
  it("puts consecutive tables of the same group under one heading, in order", () => {
    const table = (id: string, group?: string) =>
      parseCultivarTable(id, { ...APPLES, group });
    const runs = groupTables([
      table("a", "Äpfel"),
      table("b", "Äpfel"),
      table("c"),
      table("d", "Birnen"),
    ]);
    expect(runs.map((run) => [run.group, run.tables.map((t) => t.id)])).toEqual(
      [
        ["Äpfel", ["a", "b"]],
        [undefined, ["c"]],
        ["Birnen", ["d"]],
      ],
    );
  });
});

describe("parseAssortmentPage", () => {
  it("reads the catalogue URL", () => {
    expect(
      parseAssortmentPage({ catalogue_url: "https://katalog.example.de/x" }),
    ).toEqual({ catalogueUrl: "https://katalog.example.de/x" });
  });

  it("has no catalogue link while the URL is empty", () => {
    expect(parseAssortmentPage({ catalogue_url: "" })).toEqual({});
  });

  it("drops a URL that is not https with a warning instead of failing the build", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(
      parseAssortmentPage({ catalogue_url: "http://katalog.example.de/" }),
    ).toEqual({});
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("catalogue_url must be an https:// address"),
    );
  });
});

describe("paragraphs", () => {
  it("splits at blank lines and drops empty ones", () => {
    expect(paragraphs("Äpfel\nund Birnen\n\n\n  Quitten  ")).toEqual([
      "Äpfel\nund Birnen",
      "Quitten",
    ]);
    expect(paragraphs(undefined)).toEqual([]);
  });
});
