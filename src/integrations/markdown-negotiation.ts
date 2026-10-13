import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { AstroIntegration } from "astro";

/**
 * Markdown content negotiation on Vercel: a request for `/` that sends
 * `Accept: text/markdown` gets /index.md instead of the HTML homepage, and one
 * for a page that does not exist gets /404.md with a 404 status. Every other
 * request routes exactly as before, and `/` says `Vary: Accept` either way.
 *
 * This has to happen in Vercel's router, ahead of the page: `/` is an ISR
 * render, and the ISR cache keys on the path alone, so a page that answered by
 * Accept header would cache whichever variant was asked for first and serve it
 * to everyone. The @astrojs/vercel adapter has no option for routes like these,
 * so this edits the routing table it writes to .vercel/output/config.json.
 * That works because Astro puts the adapter first in the integration list, so
 * the adapter's astro:build:done has written the file by the time this runs.
 */

type Route = Record<string, unknown>;

const MARKDOWN = [
  { type: "header", key: "accept", value: "(.*)text/markdown(.*)" },
];
const MARKDOWN_TYPE = "text/markdown; charset=utf-8";

export const negotiationRoutes = (routes: Route[]): Route[] => {
  const before: Route[] = [
    { src: "^/$", headers: { Vary: "Accept" }, continue: true },
    {
      src: "^/$",
      has: MARKDOWN,
      dest: "/index.md",
      headers: { "Content-Type": MARKDOWN_TYPE, Vary: "Accept" },
      check: true,
    },
  ];
  const notFound: Route = {
    src: "/.*",
    has: MARKDOWN,
    dest: "/404.md",
    status: 404,
    headers: { "Content-Type": MARKDOWN_TYPE },
  };

  // Ahead of the adapter's own catch-all 404, if a 404 page ever adds one.
  const catchAll = routes.findIndex(
    (route) => route.src === "/.*" && route.status === 404,
  );
  const after =
    catchAll === -1
      ? [...routes, notFound]
      : [...routes.slice(0, catchAll), notFound, ...routes.slice(catchAll)];

  return [...before, ...after];
};

export default function markdownNegotiation(): AstroIntegration {
  let root: URL;
  return {
    name: "markdown-negotiation",
    hooks: {
      "astro:config:done": ({ config }) => {
        root = config.root;
      },
      "astro:build:done": ({ logger }) => {
        const path = new URL("./.vercel/output/config.json", root);
        if (!existsSync(path)) {
          logger.warn(
            "No Vercel output found; Markdown negotiation not added.",
          );
          return;
        }
        const config = JSON.parse(readFileSync(path, "utf-8"));
        config.routes = negotiationRoutes(config.routes ?? []);
        writeFileSync(path, JSON.stringify(config, null, "\t"));
        logger.info("Markdown negotiation routes added for / and 404s.");
      },
    },
  };
}
