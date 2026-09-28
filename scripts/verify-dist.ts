// Verifies the built site in dist/ against the same environment the build
// used (SITE_URL, BASE_PATH, SITE_INDEXING). Run after `npm run build`:
//   node scripts/verify-dist.ts
import { resolveDeployTarget } from "../src/deploy-target.ts";
import { isCheckedFile, verifyDist } from "../src/dist-checks.ts";
import { readDistFiles } from "../src/dist-files.ts";
import { resolveIndexing } from "../src/indexing.ts";

const distDir = "dist";
const target = resolveDeployTarget(process.env);
const indexing = resolveIndexing(process.env);

const files = readDistFiles(distDir, isCheckedFile);

const problems = verifyDist(files, target, indexing);
if (problems.length > 0) {
  console.error(`dist/ check failed (base ${target.base}, ${indexing}):`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}
console.log(
  `dist/ ok: ${files.length} files checked (base ${target.base}, ${indexing})`,
);
