import { describe, expect, it } from "vitest";
import { renderRobotsTxt, resolveIndexing } from "./indexing";

describe("resolveIndexing", () => {
  it("defaults to the phase 1 preview (noindex) when SITE_INDEXING is unset", () => {
    expect(resolveIndexing({})).toBe("noindex");
  });

  it("treats an empty SITE_INDEXING as unset", () => {
    expect(resolveIndexing({ SITE_INDEXING: "" })).toBe("noindex");
  });

  it("accepts the explicit values noindex and index", () => {
    expect(resolveIndexing({ SITE_INDEXING: "noindex" })).toBe("noindex");
    expect(resolveIndexing({ SITE_INDEXING: "index" })).toBe("index");
  });

  it("rejects any other value instead of silently guessing", () => {
    expect(() => resolveIndexing({ SITE_INDEXING: "production" })).toThrow(
      /SITE_INDEXING/,
    );
    expect(() => resolveIndexing({ SITE_INDEXING: "true" })).toThrow(
      /SITE_INDEXING/,
    );
  });
});

describe("renderRobotsTxt", () => {
  // The preview relies on the noindex meta alone: crawlers must be allowed to
  // fetch the pages, or they never see that meta.
  it("allows crawling and never ships Disallow: /", () => {
    const lines = renderRobotsTxt().split("\n");
    expect(lines).toContain("User-agent: *");
    expect(lines).toContain("Allow: /");
    expect(lines).not.toContain("Disallow: /");
  });

  it("ends with a newline", () => {
    expect(renderRobotsTxt().endsWith("\n")).toBe(true);
  });
});
