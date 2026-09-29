/**
 * The old-to-new URL redirect map (spec D11, AC-9): every public URL of the
 * old WordPress site, mapped to a page of the new information architecture
 * (`navigation.ts`) or to the home page where nothing matches. Phase 2 serves
 * it as 301s via `.htaccess` (#16); this module is only the data.
 *
 * Known defects are not carried over (spec §6): the already-404ing
 * `/spaziergang/` and the mismatched slug
 * `geaenderte-oeffnungszeiten-an-samstagen` get a sensible target instead.
 */
export interface Redirect {
  /** Old-site path, including the query string where that is the identity. */
  from: string;
  /** New site path without the base path. */
  to: string;
  /** Why this target, wherever it is not the same path. */
  reason?: string;
}

/**
 * Every URL of the old site's sitemap (`/wp-sitemap.xml` and its five
 * sub-sitemaps, read 2026-09-29), grouped by sub-sitemap, plus the known
 * alias that is not listed there.
 */
export const OLD_SITE_URLS = {
  /** `wp-sitemap-posts-page-1.xml` */
  pages: [
    "https://www.baumschule-fischer.de/",
    "https://www.baumschule-fischer.de/impressum/",
    "https://www.baumschule-fischer.de/sortiment/",
    "https://www.baumschule-fischer.de/kontakt/",
    "https://www.baumschule-fischer.de/leistungen/beratung/",
    "https://www.baumschule-fischer.de/leistungen/qualitaet/",
    "https://www.baumschule-fischer.de/leistungen/lieferservice/",
    "https://www.baumschule-fischer.de/leistungen/pflanzung/",
    "https://www.baumschule-fischer.de/leistungen/obstverkostung/",
    "https://www.baumschule-fischer.de/leistungen/apfelsaft/",
    "https://www.baumschule-fischer.de/leistungen/",
    "https://www.baumschule-fischer.de/katalog/",
    "https://www.baumschule-fischer.de/sortiment/laubgehoelze/",
    "https://www.baumschule-fischer.de/sortiment/nadelgehoelze/",
    "https://www.baumschule-fischer.de/sortiment/obstgehoelze/",
    "https://www.baumschule-fischer.de/sortiment/rhododendron/",
    "https://www.baumschule-fischer.de/sortiment/schling-kletterpflanzen/",
    "https://www.baumschule-fischer.de/sortiment/rosen/",
    "https://www.baumschule-fischer.de/sortiment/bodendecker/",
    "https://www.baumschule-fischer.de/ueber-uns/",
    "https://www.baumschule-fischer.de/ueber-uns/stellenangebote/",
    "https://www.baumschule-fischer.de/kontakt/anfahrt/",
    "https://www.baumschule-fischer.de/ueber-uns/filialen/",
    "https://www.baumschule-fischer.de/leistungen/downloads/",
    "https://www.baumschule-fischer.de/impressum/agb/",
    "https://www.baumschule-fischer.de/impressum/datenschutz/",
    "https://www.baumschule-fischer.de/ueber-uns/partner/",
    "https://www.baumschule-fischer.de/leistungen/das-perfekte-geschenk/",
    "https://www.baumschule-fischer.de/impressum/widerruf-eines-gutschein-einkaufs/",
    "https://www.baumschule-fischer.de/leistungen/das-perfekte-geschenk-danke/",
    "https://www.baumschule-fischer.de/spaziergang-2/",
    "https://www.baumschule-fischer.de/kontakt/oeffnungszeiten-2-2/",
    "https://www.baumschule-fischer.de/impressum/widerruf-gutschein/",
  ],
  /** `wp-sitemap-posts-post-1.xml`: the home page's building blocks. */
  posts: [
    "https://www.baumschule-fischer.de/stellenanzeigen/",
    "https://www.baumschule-fischer.de/baumschulen-ewald-fischer-2/",
    "https://www.baumschule-fischer.de/geaenderte-oeffnungszeiten-an-samstagen/",
    "https://www.baumschule-fischer.de/nachhaltigkeit/",
    "https://www.baumschule-fischer.de/beratung/",
    "https://www.baumschule-fischer.de/spaziergang/",
    "https://www.baumschule-fischer.de/katalog-2/",
    "https://www.baumschule-fischer.de/kontakt-und-oeffnungszeiten/",
    "https://www.baumschule-fischer.de/karte/",
    "https://www.baumschule-fischer.de/geoeffnet-status/",
    "https://www.baumschule-fischer.de/unser-sortiment/",
    "https://www.baumschule-fischer.de/laubgehoelze/",
    "https://www.baumschule-fischer.de/rhododendron/",
    "https://www.baumschule-fischer.de/nadelgehoelze/",
    "https://www.baumschule-fischer.de/schling-kletterpflanzen/",
    "https://www.baumschule-fischer.de/obstgehoelze/",
    "https://www.baumschule-fischer.de/rosen/",
    "https://www.baumschule-fischer.de/link-zum-sortiment/",
  ],
  /** `wp-sitemap-posts-wpr_templates-1.xml`: the Apfelsaft popup. */
  templates: [
    "https://www.baumschule-fischer.de/?wpr_templates=user-popup-apfelsaft",
  ],
  /** `wp-sitemap-taxonomies-category-1.xml`: the home page's row categories. */
  categories: [
    "https://www.baumschule-fischer.de/category/startseite-zeile-01/",
    "https://www.baumschule-fischer.de/category/startseite-zeile-02/",
    "https://www.baumschule-fischer.de/category/startseite-zeile-03/",
    "https://www.baumschule-fischer.de/category/startseite-zeile-09/",
    "https://www.baumschule-fischer.de/category/startseite-zeile-10/",
    "https://www.baumschule-fischer.de/category/startseite-zeile-11/",
    "https://www.baumschule-fischer.de/category/startseite-zeile-00/",
  ],
  /** `wp-sitemap-users-1.xml`: author archives. */
  authors: [
    "https://www.baumschule-fischer.de/author/basti/",
    "https://www.baumschule-fischer.de/author/nispel/",
  ],
  /**
   * Not in the sitemap: the old main menu links "Öffnungszeiten" by page ID,
   * which WordPress resolves to `/kontakt/oeffnungszeiten-2-2/`.
   */
  extras: ["https://www.baumschule-fischer.de/?page_id=4110"],
} as const satisfies Record<string, readonly string[]>;

/** An old-site URL as the path (plus query string) a redirect matches on. */
export function oldSitePath(url: string): string {
  const { pathname, search } = new URL(url);
  return `${pathname}${search}`;
}

const HOME_BLOCK =
  "Post that only served as a building block of the old home page; its content lives on the new home page.";
const HOME_CATEGORY =
  "Category that only grouped the old home page's building blocks; no archive exists on the new site.";
const SEASONAL =
  "Seasonal offer: its /saison/<slug>/ page only shows the offer while it is in its window, and the slug is editable in the CMS, so the stable target is the home page, which links the current offer.";

export const REDIRECTS: Redirect[] = [
  // Pages
  { from: "/", to: "/" },
  { from: "/impressum/", to: "/impressum/" },
  { from: "/sortiment/", to: "/sortiment/" },
  { from: "/kontakt/", to: "/kontakt/" },
  {
    from: "/leistungen/beratung/",
    to: "/service/beratung/",
    reason: "/leistungen/ is renamed to /service/.",
  },
  {
    from: "/leistungen/qualitaet/",
    to: "/service/qualitaet/",
    reason: "/leistungen/ is renamed to /service/.",
  },
  {
    from: "/leistungen/lieferservice/",
    to: "/service/lieferservice/",
    reason: "/leistungen/ is renamed to /service/.",
  },
  {
    from: "/leistungen/pflanzung/",
    to: "/service/pflanzung/",
    reason: "/leistungen/ is renamed to /service/.",
  },
  { from: "/leistungen/obstverkostung/", to: "/", reason: SEASONAL },
  { from: "/leistungen/apfelsaft/", to: "/", reason: SEASONAL },
  {
    from: "/leistungen/",
    to: "/service/",
    reason: "/leistungen/ is renamed to /service/.",
  },
  { from: "/katalog/", to: "/katalog/" },
  { from: "/sortiment/laubgehoelze/", to: "/sortiment/laubgehoelze/" },
  { from: "/sortiment/nadelgehoelze/", to: "/sortiment/nadelgehoelze/" },
  { from: "/sortiment/obstgehoelze/", to: "/sortiment/obstgehoelze/" },
  { from: "/sortiment/rhododendron/", to: "/sortiment/rhododendron/" },
  {
    from: "/sortiment/schling-kletterpflanzen/",
    to: "/sortiment/schling-kletterpflanzen/",
  },
  { from: "/sortiment/rosen/", to: "/sortiment/rosen/" },
  { from: "/sortiment/bodendecker/", to: "/sortiment/bodendecker/" },
  { from: "/ueber-uns/", to: "/ueber-uns/" },
  {
    from: "/ueber-uns/stellenangebote/",
    to: "/karriere/",
    reason: "Job postings move to their own page /karriere/.",
  },
  {
    from: "/kontakt/anfahrt/",
    to: "/besuch/",
    reason: "Directions and map are part of /besuch/.",
  },
  {
    from: "/ueber-uns/filialen/",
    to: "/besuch/",
    reason: "The locations are part of /besuch/ (spec §4).",
  },
  {
    from: "/leistungen/downloads/",
    to: "/ratgeber/",
    reason: "The guide downloads move to /ratgeber/.",
  },
  {
    from: "/impressum/agb/",
    to: "/agb/",
    reason: "Legal pages move to the top level.",
  },
  {
    from: "/impressum/datenschutz/",
    to: "/datenschutz/",
    reason: "Legal pages move to the top level.",
  },
  {
    from: "/ueber-uns/partner/",
    to: "/ueber-uns/",
    reason: "The partner links are a section of /ueber-uns/ (spec §4).",
  },
  {
    from: "/leistungen/das-perfekte-geschenk/",
    to: "/gutscheine/",
    reason: "The voucher order form moves to /gutscheine/.",
  },
  {
    from: "/impressum/widerruf-eines-gutschein-einkaufs/",
    to: "/widerruf/",
    reason: "/widerruf/ holds the withdrawal notice and the withdrawal form.",
  },
  {
    from: "/leistungen/das-perfekte-geschenk-danke/",
    to: "/gutscheine/",
    reason:
      "The thank-you page becomes a state of the /gutscheine/ order form, not a page of its own.",
  },
  {
    from: "/spaziergang-2/",
    to: "/ueber-uns/",
    reason: 'The "Spaziergang" gallery is a section of /ueber-uns/ (spec §4).',
  },
  {
    from: "/kontakt/oeffnungszeiten-2-2/",
    to: "/besuch/",
    reason: "Opening hours are part of /besuch/.",
  },
  {
    from: "/impressum/widerruf-gutschein/",
    to: "/widerruf/",
    reason: "/widerruf/ holds the withdrawal notice and the withdrawal form.",
  },

  // Posts: building blocks of the old home page
  {
    from: "/stellenanzeigen/",
    to: "/karriere/",
    reason: "Home page teaser for the job postings, which live on /karriere/.",
  },
  { from: "/baumschulen-ewald-fischer-2/", to: "/", reason: HOME_BLOCK },
  {
    from: "/geaenderte-oeffnungszeiten-an-samstagen/",
    to: "/",
    reason:
      "Home page notice bar post; its slug no longer matches its content (now a Staudenmarkt notice), so it follows the content to the home page's notices rather than the slug to /besuch/.",
  },
  { from: "/nachhaltigkeit/", to: "/", reason: HOME_BLOCK },
  {
    from: "/beratung/",
    to: "/service/beratung/",
    reason: "Home page tile linking to the consulting service.",
  },
  {
    from: "/spaziergang/",
    to: "/ueber-uns/",
    reason:
      'Home page tile for the "Spaziergang" gallery; already 404s on the old site, now points at the gallery on /ueber-uns/.',
  },
  {
    from: "/katalog-2/",
    to: "/katalog/",
    reason: "Home page tile linking to the catalogue.",
  },
  {
    from: "/kontakt-und-oeffnungszeiten/",
    to: "/besuch/",
    reason: "Home page block with contact data and opening hours.",
  },
  {
    from: "/karte/",
    to: "/besuch/",
    reason: "Home page map block; the map lives on /besuch/.",
  },
  {
    from: "/geoeffnet-status/",
    to: "/besuch/",
    reason: "Home page open/closed status of the opening hours.",
  },
  {
    from: "/unser-sortiment/",
    to: "/sortiment/",
    reason: "Home page intro to the assortment teasers.",
  },
  {
    from: "/laubgehoelze/",
    to: "/sortiment/laubgehoelze/",
    reason: "Home page teaser for the assortment category.",
  },
  {
    from: "/rhododendron/",
    to: "/sortiment/rhododendron/",
    reason: "Home page teaser for the assortment category.",
  },
  {
    from: "/nadelgehoelze/",
    to: "/sortiment/nadelgehoelze/",
    reason: "Home page teaser for the assortment category.",
  },
  {
    from: "/schling-kletterpflanzen/",
    to: "/sortiment/schling-kletterpflanzen/",
    reason: "Home page teaser for the assortment category.",
  },
  {
    from: "/obstgehoelze/",
    to: "/sortiment/obstgehoelze/",
    reason: "Home page teaser for the assortment category.",
  },
  {
    from: "/rosen/",
    to: "/sortiment/rosen/",
    reason: "Home page teaser for the assortment category.",
  },
  {
    from: "/link-zum-sortiment/",
    to: "/sortiment/",
    reason: "Home page link to the assortment.",
  },

  // Popup template
  {
    from: "/?wpr_templates=user-popup-apfelsaft",
    to: "/",
    reason:
      "The Apfelsaft popup is replaced by the seasonal offer, which the home page links while it is in its window.",
  },

  // Categories and author archives
  { from: "/category/startseite-zeile-00/", to: "/", reason: HOME_CATEGORY },
  { from: "/category/startseite-zeile-01/", to: "/", reason: HOME_CATEGORY },
  { from: "/category/startseite-zeile-02/", to: "/", reason: HOME_CATEGORY },
  { from: "/category/startseite-zeile-03/", to: "/", reason: HOME_CATEGORY },
  { from: "/category/startseite-zeile-09/", to: "/", reason: HOME_CATEGORY },
  { from: "/category/startseite-zeile-10/", to: "/", reason: HOME_CATEGORY },
  { from: "/category/startseite-zeile-11/", to: "/", reason: HOME_CATEGORY },
  {
    from: "/author/basti/",
    to: "/",
    reason: "Author archive; the new site has no authors.",
  },
  {
    from: "/author/nispel/",
    to: "/",
    reason: "Author archive; the new site has no authors.",
  },

  // Extras
  {
    from: "/?page_id=4110",
    to: "/besuch/",
    reason:
      "Page-ID alias of /kontakt/oeffnungszeiten-2-2/ used by the old main menu; opening hours are part of /besuch/.",
  },
];
