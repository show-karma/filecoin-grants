import { describe, expect, it } from "vitest";
import { negotiationRoutes } from "../markdown-negotiation";

/** The routing table @astrojs/vercel writes for this site, trimmed. */
const ADAPTER_ROUTES = [
  { handle: "filesystem" },
  { src: "^/kernel/?$", dest: "/_isr?x_astro_path=$0" },
  { src: "^/$", dest: "/_isr?x_astro_path=$0" },
];

const isMarkdown = (route: Record<string, unknown>) =>
  JSON.stringify(route.has ?? []).includes("text/markdown");

describe("Markdown negotiation routes", () => {
  const routes = negotiationRoutes(ADAPTER_ROUTES);
  const filesystem = routes.findIndex((r) => r.handle === "filesystem");

  it("answers Markdown requests for / before the ISR render can", () => {
    const home = routes.findIndex((r) => r.src === "^/$" && isMarkdown(r));
    expect(home).toBeGreaterThanOrEqual(0);
    expect(home).toBeLessThan(filesystem);
    expect(routes[home].dest).toBe("/index.md");
  });

  it("marks / as varying by Accept for every request", () => {
    expect(routes[0]).toMatchObject({
      src: "^/$",
      headers: { Vary: "Accept" },
      continue: true,
    });
  });

  it("leaves the adapter's routes as they were, in order", () => {
    expect(routes.slice(2, -1)).toEqual(ADAPTER_ROUTES);
  });

  it("ends with a Markdown 404 for anything unmatched", () => {
    expect(routes.at(-1)).toMatchObject({
      src: "/.*",
      dest: "/404.md",
      status: 404,
    });
  });

  it("goes ahead of a catch-all 404 page when one exists", () => {
    const withPage = negotiationRoutes([
      ...ADAPTER_ROUTES,
      { src: "/.*", dest: "/404.html", status: 404 },
    ]);
    expect(withPage.at(-2)?.dest).toBe("/404.md");
    expect(withPage.at(-1)?.dest).toBe("/404.html");
  });
});
