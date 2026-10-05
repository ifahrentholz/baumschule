/**
 * The "Standorte" singleton, edited in Sveltia CMS (`/admin`) and stored in
 * `src/content/locations.json`: the sales site in Berlin and the production
 * sites, shown on `/besuch/`. An ordered list rather than a collection, so
 * editors reorder it by dragging; list order is display order.
 *
 * An invalid location does not fail the build: it is skipped with a
 * `console.warn` and the rest are kept.
 */
import {
  httpUrl,
  record,
  text,
  validItems,
  warnSkipped,
} from "./content-fields";

export const LOCATION_ROLES = ["sales", "production"] as const;
export type LocationRole = (typeof LOCATION_ROLES)[number];

export const LOCATION_ROLE_LABELS: Record<LocationRole, string> = {
  sales: "Verkauf",
  production: "nur Produktion",
};

/** A static map image that links to OpenStreetMap (AC-8, spec D13). */
export interface LocationMap {
  /** Repository path of the image, e.g. `/src/assets/images/karte.jpg`. */
  image: string;
  alt: string;
  /** The same place on openstreetmap.org. */
  url: string;
}

export interface Location {
  name: string;
  role: LocationRole;
  /** The legal entity, if it differs from the site name. */
  company?: string;
  street?: string;
  postalCode?: string;
  city: string;
  /** Only for a location outside Germany. */
  country?: string;
  phone?: string;
  /** The location's own website. */
  link?: string;
  map?: LocationMap;
}

const SINGLETON = "Standorte";

export function parseLocations(raw: unknown): Location[] {
  let data: Record<string, unknown>;
  try {
    data = record(raw ?? {}, "locations file");
  } catch (error) {
    warnSkipped(SINGLETON, "all locations", error);
    return [];
  }
  return validItems(SINGLETON, data.locations, "locations", parseLocation);
}

function parseLocation(raw: unknown, field: string): Location {
  const data = record(raw, field);
  const name = text(data.name, `${field}.name`);
  if (name === undefined) throw new Error(`${field}.name is required`);
  const city = text(data.city, `${field}.city`);
  if (city === undefined) throw new Error(`${field}.city is required`);
  const location: Location = {
    name,
    role: parseRole(data.role, `${field}.role`),
    city,
  };
  const optional = {
    company: text(data.company, `${field}.company`),
    street: text(data.street, `${field}.street`),
    postalCode: text(data.postal_code, `${field}.postal_code`),
    country: text(data.country, `${field}.country`),
    phone: text(data.phone, `${field}.phone`),
    link: httpUrl(data.link, `${field}.link`),
  };
  for (const [key, value] of Object.entries(optional)) {
    if (value !== undefined) location[key as keyof typeof optional] = value;
  }
  const map = parseMap(data.map, `${field}.map`);
  if (map) location.map = map;
  return location;
}

function parseRole(value: unknown, field: string): LocationRole {
  const role = LOCATION_ROLES.find((entry) => entry === value);
  if (!role) {
    throw new Error(`${field} must be one of ${LOCATION_ROLES.join(", ")}`);
  }
  return role;
}

/** A map whose fields are all empty (how the CMS saves "no map") is none. */
function parseMap(value: unknown, field: string): LocationMap | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const data = record(value, field);
  const image = text(data.image, `${field}.image`);
  const alt = text(data.alt, `${field}.alt`);
  const url = httpUrl(data.url, `${field}.url`);
  if (image === undefined && alt === undefined && url === undefined) {
    return undefined;
  }
  if (image === undefined) throw new Error(`${field}.image is required`);
  // The image is the link's only content, so it needs a description.
  if (alt === undefined) throw new Error(`${field}.alt is required`);
  if (url === undefined) throw new Error(`${field}.url is required`);
  return { image, alt, url };
}
