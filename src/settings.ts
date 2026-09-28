/**
 * The Settings singleton: company data edited in Sveltia CMS (`/admin`) and
 * stored in `src/content/settings.json`. Used by header, footer, contact and
 * imprint.
 *
 * The CMS writes optional fields it has no value for as empty strings, so
 * `parseSettings` drops blank values: a page renders only what is filled in.
 * Required fields that are missing or blank fail the build, so a broken save
 * never reaches the deployed site.
 */
export interface Address {
  street?: string;
  postal_code?: string;
  city?: string;
}

export interface BrandColor {
  name: string;
  /** CSS colour value, e.g. `#2f6b2f`. */
  value: string;
}

export interface Settings {
  company_name: string;
  operators: string[];
  address: Address;
  phone?: string;
  fax?: string;
  email?: string;
  vat_id?: string;
  /** Repository path of the logo, e.g. `/src/assets/images/logo.svg`. */
  logo: string;
  brand_colors: BrandColor[];
}

type Data = Record<string, unknown>;

export function parseSettings(raw: unknown): Settings {
  const data = record(raw, "settings");
  const address = record(data.address ?? {}, "address");
  const settings: Settings = {
    company_name: required(data, "company_name"),
    operators: list(data.operators, "operators")
      .map((operator, i) => text(operator, `operators[${i}]`))
      .filter((operator): operator is string => operator !== undefined),
    address: withoutBlanks({
      street: text(address.street, "address.street"),
      postal_code: text(address.postal_code, "address.postal_code"),
      city: text(address.city, "address.city"),
    }),
    logo: required(data, "logo"),
    brand_colors: list(data.brand_colors, "brand_colors").map((color, i) => {
      const entry = record(color, `brand_colors[${i}]`);
      return {
        name: required(entry, "name", `brand_colors[${i}].name`),
        value: required(entry, "value", `brand_colors[${i}].value`),
      };
    }),
  };
  const optional = withoutBlanks({
    phone: text(data.phone, "phone"),
    fax: text(data.fax, "fax"),
    email: text(data.email, "email"),
    vat_id: text(data.vat_id, "vat_id"),
  });
  return { ...settings, ...optional };
}

/** A `tel:` link for a phone number as editors write it (spaces, `/`, `-`, `(0)`). */
export function telHref(phone: string): string {
  const number = phone.replace(/^(\+\d+)\s*\(0\)/, "$1");
  const leadingPlus = number.trim().startsWith("+") ? "+" : "";
  return `tel:${leadingPlus}${number.replace(/\D/g, "")}`;
}

function record(value: unknown, field: string): Data {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Settings: ${field} must be an object`);
  }
  return value as Data;
}

function list(value: unknown, field: string): unknown[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new Error(`Settings: ${field} must be a list`);
  }
  return value;
}

function text(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw new Error(`Settings: ${field} must be text`);
  }
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function required(data: Data, key: string, field = key): string {
  const value = text(data[key], field);
  if (value === undefined) throw new Error(`Settings: ${field} is required`);
  return value;
}

function withoutBlanks<T extends Record<string, string | undefined>>(
  values: T,
): Partial<Record<keyof T, string>> {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined),
  ) as Partial<Record<keyof T, string>>;
}
