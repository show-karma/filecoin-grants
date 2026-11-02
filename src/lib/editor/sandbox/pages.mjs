/*
 * Lists the site's pages from the checkout, as JSON: [{ path, label }].
 * Runs inside the sandbox with the site as the working directory.
 *
 * The label is the title the page hands its layout, so a page the assistant
 * just created shows up under the name it was given.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = "src/pages";
const FIXED = { "/": "Home", "/blog": "Blog" };

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const file = join(dir, name);
    if (statSync(file).isDirectory()) {
      if (name !== "api") walk(file, out);
    } else if (name.endsWith(".astro")) {
      out.push(file);
    }
  }
  return out;
}

function routeOf(file) {
  const rel = relative(ROOT, file).replace(/\.astro$/, "");
  const route = "/" + rel.replace(/(^|\/)index$/, "");
  return route.replace(/\/$/, "") || "/";
}

function titleCase(slug) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

function labelOf(file, route) {
  if (FIXED[route]) return FIXED[route];
  const src = readFileSync(file, "utf8");
  const layout = /<\w*Layout\b([\s\S]*?)>/.exec(src);
  const inLayout = layout && /\btitle="([^"]+)"/.exec(layout[1]);
  const inHead = /<title>([^<]+)<\/title>/.exec(src);
  const title = (inLayout ?? inHead)?.[1].trim();
  return title || titleCase(route.split("/").pop());
}

const pages = walk(ROOT)
  .filter((f) => !/[[\]]/.test(f) && !/^src\/pages\/(edit|404)\.astro$/.test(f))
  .map((file) => {
    const path = routeOf(file);
    return { path, label: labelOf(file, path) };
  });

process.stdout.write(JSON.stringify(pages));
