import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readDistFiles } from "./dist-files";

describe("readDistFiles", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "dist-files-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("reads files at every depth, with paths relative to the directory and / separators", () => {
    mkdirSync(join(dir, "about", "team"), { recursive: true });
    mkdirSync(join(dir, "_astro"));
    writeFileSync(join(dir, "index.html"), "root");
    writeFileSync(join(dir, "about", "index.html"), "about");
    writeFileSync(join(dir, "about", "team", "index.html"), "team");
    writeFileSync(join(dir, "_astro", "site.css"), "css");

    const files = readDistFiles(dir, () => true).sort((a, b) =>
      a.path.localeCompare(b.path),
    );

    expect(files).toEqual([
      { path: "_astro/site.css", content: "css" },
      { path: "about/index.html", content: "about" },
      { path: "about/team/index.html", content: "team" },
      { path: "index.html", content: "root" },
    ]);
  });

  it("skips directories and files the filter rejects, without reading them", () => {
    mkdirSync(join(dir, "nested.html"));
    writeFileSync(join(dir, "index.html"), "page");
    writeFileSync(join(dir, "favicon.svg"), "<svg/>");
    const seen: string[] = [];

    const files = readDistFiles(dir, (path) => {
      seen.push(path);
      return path.endsWith(".html");
    });

    expect(files).toEqual([{ path: "index.html", content: "page" }]);
    expect(seen.sort()).toEqual(["favicon.svg", "index.html"]);
  });
});
