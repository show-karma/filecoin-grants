/*
 * One-off: pushes src/content/blog/*.md into Sanity as published posts.
 * Re-running overwrites the same documents (ids are derived from the slug).
 *
 *   SANITY_WRITE_TOKEN=... node scripts/migrate-blog-to-sanity.ts
 */
import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { createClient } from "@sanity/client";
import { htmlToBlocks } from "@sanity/block-tools";
import { Schema } from "@sanity/schema";
import { JSDOM } from "jsdom";
import { marked } from "marked";
import { schemaTypes } from "../src/sanity/schema.ts";

const POSTS_DIR = "src/content/blog";
const PUBLIC_DIR = "public";

const env = await loadDotEnv();
const projectId = env.PUBLIC_SANITY_PROJECT_ID;
const token = env.SANITY_WRITE_TOKEN;
if (!projectId || !token) {
  throw new Error(
    "PUBLIC_SANITY_PROJECT_ID and SANITY_WRITE_TOKEN are required",
  );
}

const client = createClient({
  projectId,
  dataset: env.PUBLIC_SANITY_DATASET ?? "production",
  apiVersion: "2026-10-01",
  token,
  useCdn: false,
});

const blockContentType = Schema.compile({ name: "filpgf", types: schemaTypes })
  .get("post")
  .fields.find((f: { name: string }) => f.name === "body").type;

for (const file of (await readdir(POSTS_DIR)).filter((f) =>
  f.endsWith(".md"),
)) {
  const slug = basename(file, ".md");
  const { frontmatter, markdown } = splitFrontmatter(
    await readFile(join(POSTS_DIR, file), "utf8"),
  );
  if (frontmatter.draft === "true") {
    console.log(`skip ${slug} (draft)`);
    continue;
  }

  const html = await marked.parse(markdown);
  const assets = await uploadImages(html);
  const body = htmlToBlocks(html, blockContentType, {
    parseHtml: (h) => new JSDOM(h).window.document,
    rules: [
      {
        deserialize(el, _next, block) {
          if (el.nodeName.toLowerCase() !== "img") return undefined;
          const img = el as HTMLImageElement;
          const assetId = assets.get(img.getAttribute("src") ?? "");
          if (!assetId) return undefined;
          return block({
            _type: "image",
            asset: { _type: "reference", _ref: assetId },
            alt: img.getAttribute("alt") || undefined,
          });
        },
      },
    ],
  });

  await client.createOrReplace({
    _id: `post-${slug}`,
    _type: "post",
    title: frontmatter.title,
    slug: { _type: "slug", current: slug },
    date: frontmatter.date,
    description: frontmatter.description,
    author: frontmatter.author || undefined,
    body,
  });
  console.log(`ok   ${slug}`);
}

async function uploadImages(html: string) {
  const map = new Map<string, string>();
  for (const [, src] of html.matchAll(/<img[^>]+src="([^"]+)"/g)) {
    if (map.has(src) || !src.startsWith("/")) continue;
    const buffer = await readFile(join(PUBLIC_DIR, src));
    const asset = await client.assets.upload("image", buffer, {
      filename: basename(src),
    });
    map.set(src, asset._id);
  }
  return map;
}

function splitFrontmatter(raw: string) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error("missing frontmatter");
  const frontmatter: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const value = line.slice(idx + 1).trim();
    frontmatter[line.slice(0, idx).trim()] = value.replace(/^"(.*)"$/, "$1");
  }
  return { frontmatter, markdown: match[2] };
}

async function loadDotEnv() {
  const out: Record<string, string | undefined> = { ...process.env };
  for (const name of [".env", ".env.local"]) {
    const text = await readFile(name, "utf8").catch(() => "");
    for (const line of text.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^["'](.*)["']$/, "$1");
    }
  }
  return out;
}
