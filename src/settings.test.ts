import { describe, expect, it } from "vitest";
import { parseSettings, telHref } from "./settings";

const COMPLETE = {
  company_name: "Baumschule Fischer",
  operators: ["Anna Fischer", "Ben Fischer"],
  address: { street: "Gartenweg 1", postal_code: "12345", city: "Berlin" },
  phone: "030 123456",
  fax: "030 123457",
  email: "info@example.com",
  vat_id: "DE123456789",
  logo: "/src/assets/images/logo.svg",
  brand_colors: [{ name: "Green", value: "#2f6b2f" }],
};

describe("parseSettings", () => {
  it("reads a complete settings file", () => {
    expect(parseSettings(COMPLETE)).toEqual(COMPLETE);
  });

  it("drops optional values the CMS saved as empty strings, so they do not render", () => {
    const settings = parseSettings({
      company_name: "Baumschule Fischer",
      operators: ["", "Anna Fischer"],
      address: { street: "", postal_code: "", city: "" },
      phone: "",
      fax: " ",
      email: "",
      vat_id: "",
      logo: "/src/assets/images/logo.svg",
      brand_colors: [],
    });
    expect(settings).toEqual({
      company_name: "Baumschule Fischer",
      operators: ["Anna Fischer"],
      address: {},
      logo: "/src/assets/images/logo.svg",
      brand_colors: [],
    });
  });

  it("treats missing optional fields like empty ones", () => {
    expect(
      parseSettings({
        company_name: "Baumschule Fischer",
        logo: "/src/assets/images/logo.svg",
      }),
    ).toEqual({
      company_name: "Baumschule Fischer",
      operators: [],
      address: {},
      logo: "/src/assets/images/logo.svg",
      brand_colors: [],
    });
  });

  it("trims surrounding whitespace an editor may have typed", () => {
    const settings = parseSettings({ ...COMPLETE, phone: " 030 123456 " });
    expect(settings.phone).toBe("030 123456");
  });

  it("rejects a file without company name or logo, naming the field", () => {
    expect(() => parseSettings({ ...COMPLETE, company_name: " " })).toThrow(
      /company_name/,
    );
    expect(() => parseSettings({ ...COMPLETE, logo: undefined })).toThrow(
      /logo/,
    );
  });

  it("rejects values of the wrong type, naming the field", () => {
    expect(() => parseSettings(null)).toThrow(/settings/);
    expect(() => parseSettings({ ...COMPLETE, phone: 30123456 })).toThrow(
      /phone/,
    );
    expect(() => parseSettings({ ...COMPLETE, operators: "Anna" })).toThrow(
      /operators/,
    );
    expect(() =>
      parseSettings({ ...COMPLETE, brand_colors: [{ name: "Green" }] }),
    ).toThrow(/brand_colors\[0\]\.value/);
  });
});

describe("telHref", () => {
  it("builds a tel: link from a phone number as editors write it", () => {
    expect(telHref("030 / 123 45-6")).toBe("tel:030123456");
    expect(telHref("+49 (0)30 123456")).toBe("tel:+4930123456");
  });
});
