/*
 * Quick wording changes, without the coding agent: a fast model reads the
 * text on the page and the request, and either rewrites some of that text or
 * says the request needs the agent. Nothing is written here: the edits are
 * tried against the source in memory (text-edit.mjs, the same exact-match edit
 * as typing over the preview), and only edits that would apply are returned.
 * The editor then writes them with text-edit.mjs. The model never sees code.
 *
 *   node .editor/quick-edit.mjs <base64 JSON {request, page, model, blocks}>
 *
 * blocks: [{id, text, tag, file, selected}] — each one run of text as it
 * appears on the page, in the order it appears.
 *
 * Prints {ok:true, edits, summary} or {ok:false, reason}. Run from the
 * site directory. The API key comes from the sandbox's environment.
 */
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { applyEdits, sourceFiles, syntaxOk } from "./text-edit.mjs";

const SDK_DIR = process.env.EDITOR_SDK_DIR || "/home/user/.editor/sdk";

export const SYSTEM = `You make quick wording changes to a website for the person editing it. You get the text on the page they are looking at, as numbered blocks in page order, and their request.

Each block is one run of text exactly as it appears on the page. When a sentence contains a link or bold words, it is split into several blocks; keep the pieces reading as one sentence. Blocks marked ★ are what the person selected: "this", "here" and "these" mean those.

Choose "edit" when the request can be done completely by changing the words of existing blocks: rewording, shortening, expanding, fixing typos or grammar, changing tone, replacing one phrase or name with another. Return the full new text of each block you change, and only those.

Choose "agent" (with no edits) for anything else: layout, styling, colours, fonts, sizes, images, links or where they point, adding or removing elements, sections, buttons or list items, moving things, other pages, or wording that needs facts, numbers, names or dates you were not given. Also choose "agent" when you are unsure what the person means or which block they mean.

Rules for new text:
- Plain text on one line: no Markdown, HTML, line breaks, or curly or angle brackets.
- Keep the site's language, voice, capitalisation and punctuation style. Keep the leading words of a block that continues after a link, and so on, consistent with its neighbours.
- Never invent facts, figures or quotes. Leave numbers as they are unless asked.
- Change only what the request asks for.

summary: what changed, 3 to 8 words, past tense, as a person would say it (for example "Shortened the intro paragraph").`;

export const SCHEMA = {
  type: "object",
  properties: {
    action: { type: "string", enum: ["edit", "agent"] },
    summary: { type: "string" },
    edits: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "integer" },
          text: { type: "string" },
        },
        required: ["id", "text"],
        additionalProperties: false,
      },
    },
  },
  required: ["action", "summary", "edits"],
  additionalProperties: false,
};

/** The request and the page, as the model reads them. */
export function promptFor({ request, page, blocks }) {
  const lines = blocks.map(
    (b) => `[${b.id}]${b.selected ? " ★" : ""} <${b.tag || "text"}> ${b.text}`,
  );
  return `Page: ${page || "/"}\n\nText on the page:\n${lines.join("\n")}\n\nRequest: ${request}`;
}

const ONE_LINE = /^[^\r\n<>{}]*$/;

/**
 * The model's answer, checked against the blocks it was given. Returns the
 * edits to make ({before, after, file}) or why not.
 */
export function editsFrom(answer, blocks) {
  if (!answer || answer.action !== "edit" || !Array.isArray(answer.edits))
    return { ok: false, reason: "agent" };
  const byId = new Map(blocks.map((b) => [b.id, b]));
  const edits = [];
  const seen = new Set();
  for (const e of answer.edits) {
    const block = byId.get(e && e.id);
    if (!block || seen.has(block.id) || typeof e.text !== "string")
      return { ok: false, reason: "bad-answer" };
    seen.add(block.id);
    const after = e.text.replace(/\s+/g, " ").trim();
    if (!after || after.length > 2000 || !ONE_LINE.test(after))
      return { ok: false, reason: "bad-answer" };
    if (after === block.text) continue;
    edits.push({ id: block.id, before: block.text, after, file: block.file });
  }
  if (!edits.length) return { ok: false, reason: "no-change" };
  if (edits.length > 30) return { ok: false, reason: "too-many" };
  return { ok: true, edits };
}

async function loadSdk() {
  const require = createRequire(`${SDK_DIR}/package.json`);
  const mod = await import(
    pathToFileURL(require.resolve("@anthropic-ai/sdk")).href
  );
  return mod.default?.default ?? mod.default ?? mod.Anthropic;
}

async function ask(req) {
  const Anthropic = await loadSdk();
  const client = new Anthropic({ timeout: 25_000, maxRetries: 1 });
  const haiku = /^claude-haiku/.test(req.model);
  const message = await client.messages.create({
    model: req.model,
    max_tokens: 4096,
    system: SYSTEM,
    messages: [{ role: "user", content: promptFor(req) }],
    // Speed matters more than deliberation for a wording change.
    ...(haiku ? { thinking: { type: "disabled" } } : {}),
    output_config: {
      format: { type: "json_schema", schema: SCHEMA },
      ...(haiku ? {} : { effort: "low" }),
    },
  });
  if (message.stop_reason !== "end_turn") return null;
  const text = message.content.find((c) => c.type === "text")?.text ?? "";
  return JSON.parse(text);
}

export async function quickEdit(req) {
  if (
    typeof req.request !== "string" ||
    !req.request.trim() ||
    !Array.isArray(req.blocks) ||
    !req.blocks.length ||
    typeof req.model !== "string"
  )
    return { ok: false, reason: "bad-request" };
  let answer;
  try {
    answer = await ask(req);
  } catch (e) {
    return {
      ok: false,
      reason: "model",
      detail: String(e && e.message).slice(0, 200),
    };
  }
  const picked = editsFrom(answer, req.blocks);
  if (!picked.ok) return picked;
  // A dry run: would every edit land, exactly once, and still parse?
  const res = applyEdits(sourceFiles(), picked.edits);
  if (!res.ok) return { ok: false, reason: res.reason };
  for (const f of res.files)
    if (!(await syntaxOk(f.path, f.content)))
      return { ok: false, reason: "syntax" };
  return {
    ok: true,
    edits: picked.edits,
    summary: String(answer.summary || "").slice(0, 80),
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const started = Date.now();
  let result;
  try {
    result = await quickEdit(
      JSON.parse(Buffer.from(process.argv[2] ?? "", "base64").toString("utf8")),
    );
  } catch (e) {
    result = {
      ok: false,
      reason: "error",
      detail: String(e && e.message).slice(0, 200),
    };
  }
  process.stdout.write(
    JSON.stringify({ ...result, ms: Date.now() - started }) + "\n",
  );
}
