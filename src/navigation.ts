/**
 * The site's information architecture (spec §4, finalised in #4): the page
 * tree with its German labels, grouped as the main navigation shows it, plus
 * the legal pages linked from the footer.
 *
 * Paths are site paths without the base path (`/sortiment/`); `withBase`
 * turns them into links for the current deploy target. The grouping, not the
 * URL, decides where a page sits: `/karriere/` belongs to "Über uns".
 *
 * Seasonal offers (`/saison/<slug>/`) are not listed: they only show an
 * offer while it is in its window and are linked from the home page then.
 */
export interface NavItem {
  label: string;
  path: string;
  children?: NavItem[];
}

export type CurrentState = "page" | "section" | false;

/** The seven assortment categories, keeping the old site's slugs. */
export const ASSORTMENT_CATEGORIES: NavItem[] = [
  { label: "Laubgehölze", path: "/sortiment/laubgehoelze/" },
  { label: "Nadelgehölze", path: "/sortiment/nadelgehoelze/" },
  { label: "Obstgehölze", path: "/sortiment/obstgehoelze/" },
  { label: "Rhododendron", path: "/sortiment/rhododendron/" },
  {
    label: "Schling- und Kletterpflanzen",
    path: "/sortiment/schling-kletterpflanzen/",
  },
  { label: "Rosen", path: "/sortiment/rosen/" },
  { label: "Bodendecker", path: "/sortiment/bodendecker/" },
];

export const SERVICES: NavItem[] = [
  { label: "Beratung", path: "/service/beratung/" },
  { label: "Qualität", path: "/service/qualitaet/" },
  { label: "Lieferservice", path: "/service/lieferservice/" },
  { label: "Pflanzung", path: "/service/pflanzung/" },
];

export const MAIN_NAV: NavItem[] = [
  {
    label: "Sortiment",
    path: "/sortiment/",
    children: [
      ...ASSORTMENT_CATEGORIES,
      { label: "Katalog", path: "/katalog/" },
    ],
  },
  {
    label: "Service",
    path: "/service/",
    children: [...SERVICES, { label: "Ratgeber", path: "/ratgeber/" }],
  },
  { label: "Gutscheine", path: "/gutscheine/" },
  { label: "Öffnungszeiten", path: "/besuch/" },
  {
    label: "Über uns",
    path: "/ueber-uns/",
    children: [{ label: "Karriere", path: "/karriere/" }],
  },
  { label: "Kontakt", path: "/kontakt/" },
];

export const LEGAL_NAV: NavItem[] = [
  { label: "Impressum", path: "/impressum/" },
  { label: "Datenschutz", path: "/datenschutz/" },
  { label: "AGB", path: "/agb/" },
  { label: "Widerruf", path: "/widerruf/" },
];

/** Every page of the tree, sections before their children. */
export function allPages(): NavItem[] {
  return [...MAIN_NAV, ...LEGAL_NAV].flatMap((item) => [
    item,
    ...(item.children ?? []),
  ]);
}

/** A site path as a link below the base path (`/baumschule` or `/`). */
export function withBase(base: string, path: string): string {
  return `${base.replace(/\/+$/, "")}${path}`;
}

/**
 * The trail from the top-level item down to the page at `path`, e.g.
 * Sortiment › Rosen. Empty for the home page and paths outside the tree.
 */
export function breadcrumbTrail(path: string): NavItem[] {
  const target = normalise(path);
  for (const item of [...MAIN_NAV, ...LEGAL_NAV]) {
    if (item.path === target) return [item];
    const child = item.children?.find((c) => c.path === target);
    if (child) return [item, child];
  }
  return [];
}

/**
 * Whether a navigation item is the current page (`aria-current="page"`), the
 * section the current page belongs to, or neither.
 */
export function currentState(
  currentPath: string,
  itemPath: string,
): CurrentState {
  const trail = breadcrumbTrail(currentPath);
  const index = trail.findIndex((item) => item.path === itemPath);
  if (index === -1) return false;
  return index === trail.length - 1 ? "page" : "section";
}

function normalise(path: string): string {
  return path.endsWith("/") ? path : `${path}/`;
}
