// @ts-check
import { defineConfig } from "astro/config";
import { loadEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";
import vercel from "@astrojs/vercel";
import react from "@astrojs/react";
import sanity from "@sanity/astro";

const { PUBLIC_SANITY_PROJECT_ID, PUBLIC_SANITY_DATASET } = loadEnv(
  process.env.NODE_ENV ?? "development",
  process.cwd(),
  "PUBLIC_",
);

// https://astro.build/config
export default defineConfig({
  site: "https://www.filpgf.io",
  trailingSlash: "ignore",
  integrations: [
    sitemap({ filter: (page) => !page.includes("/studio") }),
    react(),
    /*
     * Blog posts live in Sanity. The Studio is served at /studio as a static
     * page (hash router), so it needs no server function. useCdn is off because
     * posts are only read at build time, where a stale CDN copy would be a bug.
     */
    sanity({
      projectId: PUBLIC_SANITY_PROJECT_ID,
      dataset: PUBLIC_SANITY_DATASET ?? "production",
      apiVersion: "2026-10-01",
      useCdn: false,
      studioBasePath: "/studio",
    }),
  ],
  /*
   * Static by default: every page is prerendered unless it opts out with
   * `export const prerender = false`. Only /kernel and / do, because only they
   * read the GAP API — the rest is editorial copy that cannot go stale between
   * deploys and must not pay for a function invocation.
   *
   * ISR caches those two renders at the edge for an hour, so the 17 upstream
   * requests /kernel needs are paid roughly once an hour rather than per
   * visitor, and the pages refresh without a rebuild.
   */
  output: "static",
  adapter: vercel({
    // The editor's save and publish calls wait on Boat and GitHub; the
    // non-Fluid default (10–15 s) is too short for them.
    maxDuration: 60,
    isr: {
      expiration: 3600,
      /*
       * The site editor (/edit and its API) answers per person and per
       * moment — sign-in, workspace status, the agent's progress. An hour of
       * edge cache would serve one person's answer to the next, so these run
       * as plain functions.
       */
      exclude: [/^\/edit$/, /^\/api\/editor\//],
    },
  }),
  vite: {
    plugins: [tailwindcss()],
  },
});
