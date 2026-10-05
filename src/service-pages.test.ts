import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it, vi } from "vitest";
import type { ServiceEntry } from "./service-entries";

// Two services that appear nowhere else: one with a teaser image, a body and
// a gallery, one without any content yet.
vi.mock("./service-entries", async () => {
  const Content = (await import("./seasonal-offers.fixtures/Body.astro"))
    .default;
  const image = (await import("./assets/images/apfelsaft.jpg")).default;
  const entries: ServiceEntry[] = [
    {
      service: {
        slug: "probeberatung",
        title: "Probeberatung 4711",
        teaser: "Teaser 4711",
        teaserImage: "/src/assets/images/apfelsaft.jpg",
        gallery: [],
      },
      Content,
      hasBody: true,
      teaserImage: image,
      gallery: [{ image, alt: "Galeriebild 4711" }],
    },
    {
      service: { slug: "probeleer", title: "Probeleer 4711", gallery: [] },
      Content,
      hasBody: false,
      gallery: [],
    },
  ];
  return { loadServices: () => entries };
});

// The fixture image's `<img>` tags (the site header's logo is another one).
function fixtureImages(html: string): string[] {
  return html.match(/<img[^>]*apfelsaft\.jpg[^>]*>/g) ?? [];
}

// Astro writes an empty `alt` as a bare attribute.
const DECORATIVE = /\salt(?:="")?[\s>]/;

async function render(name: string, options = {}): Promise<string> {
  const container = await AstroContainer.create();
  const component = (await import(`./pages/service/${name}.astro`)).default;
  return container.renderToString(component, options);
}

async function servicePage(slug: string): Promise<string> {
  const { getStaticPaths } = await import("./pages/service/[slug].astro");
  const path = getStaticPaths().find((entry) => entry.params.slug === slug);
  if (!path) throw new Error(`no page for ${slug}`);
  return render("[slug]", { params: path.params, props: path.props });
}

describe("the services overview /service/", () => {
  it("lists every service in order, linked below the base path, with its teaser and image", async () => {
    const html = await render("index");
    expect(html.indexOf("Probeberatung 4711")).toBeLessThan(
      html.indexOf("Probeleer 4711"),
    );
    expect(html).toMatch(/href="[^"]*\/service\/probeberatung\/"/);
    expect(html).toMatch(/href="[^"]*\/service\/probeleer\/"/);
    expect(html).toContain("Teaser 4711");
    const images = fixtureImages(html);
    expect(images).toHaveLength(1);
    expect(images[0]).toMatch(DECORATIVE);
  });
});

describe("a service page /service/<slug>/ (AC-3)", () => {
  it("exists for every service", async () => {
    const { getStaticPaths } = await import("./pages/service/[slug].astro");
    expect(getStaticPaths().map((entry) => entry.params.slug)).toEqual([
      "probeberatung",
      "probeleer",
    ]);
  });

  it("shows the title, the teaser as lead, the teaser image above the body, and the body", async () => {
    const html = await servicePage("probeberatung");
    expect(html).toMatch(/<h1[^>]*>Probeberatung 4711<\/h1>/);
    expect(html).toContain("Teaser 4711");
    expect(html).toContain("Probetext 4711");
    const teaserImage = fixtureImages(html).find((tag) =>
      tag.includes('class="service-image"'),
    );
    expect(teaserImage).toMatch(DECORATIVE);
    expect(html.indexOf('class="service-image"')).toBeLessThan(
      html.indexOf("Probetext 4711"),
    );
    expect(html).not.toContain("wird gerade neu aufgebaut");
  });

  it("shows the gallery as a labelled list with the images' descriptions", async () => {
    const html = await servicePage("probeberatung");
    const gallery = html.slice(
      html.indexOf('<ul class="gallery'),
      html.indexOf("</ul>", html.indexOf('<ul class="gallery')),
    );
    expect(gallery).toMatch(/aria-label="Bilder: Probeberatung 4711"/);
    expect(gallery).toMatch(/<img[^>]*alt="Galeriebild 4711"/);
  });

  it("shows the being-rebuilt notice for a service without content", async () => {
    const html = await servicePage("probeleer");
    expect(html).toMatch(/<h1[^>]*>Probeleer 4711<\/h1>/);
    expect(html).toContain("wird gerade neu aufgebaut");
    expect(fixtureImages(html)).toEqual([]);
  });
});
