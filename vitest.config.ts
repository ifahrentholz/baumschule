/// <reference types="vitest/config" />
// Vitest runs through Astro's Vite config, so tests can render `.astro`
// components with the Container API.
import { getViteConfig } from "astro/config";

export default getViteConfig({ test: {} });
