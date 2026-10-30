/*
 * The preview's Astro config, inside the sandbox only (site/.editor/, which
 * .git/info/exclude hides from git). It is the site's own config plus one
 * thing: the editor's layer, injected into every page by the dev server.
 * `astro build` never sees this file.
 */
import { readFileSync } from "node:fs";
import base from "../astro.config.mjs";

const overlay = readFileSync(`${process.cwd()}/.editor/overlay.js`, "utf8");

// Only the editor may frame the preview (written by the session at start).
let ancestors = "";
try {
  ancestors = readFileSync(
    `${process.cwd()}/.editor/frame-ancestors.txt`,
    "utf8",
  )
    .split(/\s+/)
    .filter((o) => /^https?:\/\/[a-z0-9.-]+(:\d+)?$/i.test(o))
    .join(" ");
} catch {}

export default {
  ...base,
  // Source annotations (data-astro-source-file) come with the dev toolbar;
  // the overlay hides the toolbar itself.
  devToolbar: { ...(base.devToolbar ?? {}), enabled: true },
  server: {
    ...(base.server ?? {}),
    headers: {
      ...(base.server?.headers ?? {}),
      ...(ancestors
        ? { "Content-Security-Policy": `frame-ancestors ${ancestors}` }
        : {}),
    },
  },
  integrations: [
    ...(base.integrations ?? []),
    {
      name: "filpgf-editor-overlay",
      hooks: {
        "astro:config:setup": ({ command, injectScript }) => {
          if (command === "dev") injectScript("head-inline", overlay);
        },
      },
    },
  ],
};
