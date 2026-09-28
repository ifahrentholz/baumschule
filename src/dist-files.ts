/**
 * Reads the built site for `scripts/verify-dist.ts`. Kept free of value
 * imports from `src/` so the script runs under plain `node` (type stripping
 * needs explicit `.ts` extensions, which `src/` does not use).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import type { DistFile } from "./dist-checks";

/**
 * Returns every file below `distDir`, at any depth, whose path (relative to
 * `distDir`, with `/` separators) passes `include`. Directories are skipped;
 * rejected files are not read.
 */
export function readDistFiles(
  distDir: string,
  include: (path: string) => boolean,
): DistFile[] {
  return readdirSync(distDir, { recursive: true })
    .map((entry) => join(distDir, String(entry)))
    .filter((path) => statSync(path).isFile())
    .map((path) => relative(distDir, path).split(sep).join("/"))
    .filter(include)
    .map((path) => ({
      path,
      content: readFileSync(join(distDir, path), "utf8"),
    }));
}
