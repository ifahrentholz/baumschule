import { defineConfig } from "astro/config";
import { resolveDeployTarget } from "./src/deploy-target";

const { site, base } = resolveDeployTarget(process.env);

// https://docs.astro.build/en/reference/configuration-reference/
export default defineConfig({
  output: "static",
  site,
  base,
});
