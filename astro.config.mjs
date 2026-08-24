// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";
import vercel from "@astrojs/vercel";

// https://astro.build/config
export default defineConfig({
  site: "https://www.filpgf.io",
  trailingSlash: "ignore",
  integrations: [sitemap()],
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
    isr: {
      expiration: 3600,
    },
  }),
  vite: {
    plugins: [tailwindcss()],
  },
});
