import { describe, expect, it } from "vitest";
import { resolveDeployTarget } from "./deploy-target";

describe("resolveDeployTarget", () => {
  it("defaults to the phase 1 GitHub Pages target when no env is set", () => {
    expect(resolveDeployTarget({})).toEqual({
      site: "https://ifahrentholz.de",
      base: "/baumschule",
    });
  });

  it("uses the phase 2 target when SITE_URL and BASE_PATH are set", () => {
    expect(
      resolveDeployTarget({
        SITE_URL: "https://www.baumschule-fischer.de",
        BASE_PATH: "/",
      }),
    ).toEqual({ site: "https://www.baumschule-fischer.de", base: "/" });
  });

  it("normalises a base path without a leading slash and with a trailing slash", () => {
    expect(resolveDeployTarget({ BASE_PATH: "baumschule/" }).base).toBe(
      "/baumschule",
    );
  });

  it("treats empty values as unset", () => {
    expect(resolveDeployTarget({ SITE_URL: "", BASE_PATH: "" })).toEqual({
      site: "https://ifahrentholz.de",
      base: "/baumschule",
    });
  });

  it("rejects a SITE_URL that is not an absolute http(s) URL", () => {
    expect(() => resolveDeployTarget({ SITE_URL: "ifahrentholz.de" })).toThrow(
      /SITE_URL/,
    );
  });
});
