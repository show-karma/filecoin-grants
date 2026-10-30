/*
 * Direct text edits: replace the exact words someone typed over in the
 * preview, in the source file they came from, without asking the agent.
 *
 *   node .editor/text-edit.mjs <base64 JSON {edits: [{before, after, file?}]}>
 *
 * Prints {ok:true, files} or {ok:false, reason}. All of the edits land, or
 * none do. It refuses whenever it cannot be sure: the text is not found, found
 * more than once, or the new text would need escaping it can't do safely. The
 * editor then hands the change to the agent instead. Run from the site
 * directory.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import { pathToFileURL } from "node:url";

const EXTS = new Set([
  ".astro",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".md",
  ".mdx",
  ".json",
  ".html",
  ".yaml",
  ".yml",
]);
/** Protected source paths (see PROTECTED_* in sandbox-scripts.ts; a test keeps them in step). */
export const SKIP = [
  "src/lib/editor",
  "src/pages/api",
  "src/components/editor",
  "src/middleware",
  "src/pages/edit.astro",
];
const CODE = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".json"]);

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A pattern for `before` that tolerates line wrapping and common entity spellings. */
export function pattern(before) {
  const words = before.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  const word = (w) =>
    [...w]
      .map((ch) => {
        if (ch === "'" || ch === "’") return "(?:'|’|&rsquo;|&#39;|&apos;)";
        if (ch === '"' || ch === "“" || ch === "”")
          return '(?:"|“|”|&quot;|&ldquo;|&rdquo;)';
        if (ch === "&") return "(?:&|&amp;)";
        if (ch === "—") return "(?:—|&mdash;)";
        if (ch === "–") return "(?:–|&ndash;)";
        return esc(ch);
      })
      .join("");
  return new RegExp(words.map(word).join("\\s+"), "g");
}

function frontmatterEnd(source) {
  if (!source.startsWith("---")) return -1;
  const end = source.indexOf("\n---", 3);
  return end === -1 ? -1 : end + 4;
}

const QUOTES = new Set(['"', "'", "`"]);

function prevChar(source, i, skipNewlines) {
  while (
    i > 0 &&
    (source[i - 1] === " " ||
      source[i - 1] === "\t" ||
      (skipNewlines && /\s/.test(source[i - 1])))
  )
    i--;
  return i > 0 ? source[i - 1] : "";
}

function nextChar(source, i, skipNewlines) {
  while (
    i < source.length &&
    (source[i] === " " ||
      source[i] === "\t" ||
      (skipNewlines && /\s/.test(source[i])))
  )
    i++;
  return i < source.length ? source[i] : "";
}

/**
 * Whether [start, end) is a whole piece of content, not part of one: an entire
 * string literal, an entire attribute value, an entire text node, or an entire
 * Markdown line. A match inside a path, a class name or a longer sentence is
 * not something someone typed over in the preview.
 */
export function wholeValue(path, source, start, end) {
  const ext = extname(path);
  const before = source[start - 1];
  const wholeString = QUOTES.has(before) && source[end] === before;
  if (CODE.has(ext) || (ext === ".astro" && start < frontmatterEnd(source)))
    return wholeString;
  if (wholeString) return true;
  const textNode =
    /[>}]/.test(prevChar(source, start, true) || "x") &&
    /[<{]/.test(nextChar(source, end, true) || "x");
  if (textNode) return true;
  if (ext === ".md" || ext === ".mdx") {
    const p = prevChar(source, start, false);
    const n = nextChar(source, end, false);
    return (
      (p === "" || p === "\n" || /[#>*_\-[.]/.test(p)) &&
      (n === "" || n === "\n" || /[*_\])]/.test(n))
    );
  }
  return false;
}

/**
 * How `after` must be written at `start` in `source`, or null if it can't be
 * done safely. Code contexts: inside a string literal, escaped for its quote.
 * Markup text: plain, but no characters that would open a tag or expression.
 * YAML (data files, Markdown frontmatter) and JSX text are left to the agent.
 */
export function encodeFor(path, source, start, after) {
  if (/[\r\n]/.test(after)) return null;
  const ext = extname(path);
  if (ext === ".yml" || ext === ".yaml") return null;
  const inFrontmatter = start < frontmatterEnd(source);
  if (inFrontmatter && ext !== ".astro") return null;
  const lineStart = source.lastIndexOf("\n", start - 1) + 1;
  const left = source.slice(lineStart, start);

  if (CODE.has(ext) || inFrontmatter) {
    const quote = openQuote(left);
    if (!quote) return null;
    if (ext === ".json" && quote !== '"') return null;
    let out = after
      .replace(/\\/g, "\\\\")
      .split(quote)
      .join("\\" + quote);
    if (quote === "`") out = out.replace(/\$\{/g, "\\${");
    return out;
  }
  if (ext === ".md") return /[<>{}[\]*_`#|\\]/.test(after) ? null : after;
  // Astro/HTML/MDX template: what is the nearest structural character?
  const m = /[<>{}"'`]/.exec([...left].reverse().join(""));
  const nearest = m ? m[0] : ">";
  if (nearest === ">" || nearest === "}") {
    return /[<>{}]/.test(after) ? null : after;
  }
  if (nearest === '"' || nearest === "'" || nearest === "`") {
    // An attribute value or a string inside an expression.
    return after.includes(nearest) || /[<>{}]/.test(after) ? null : after;
  }
  return null;
}

/** The quote character of the string literal that is open at the end of `left`. */
function openQuote(left) {
  let quote = null;
  for (let i = 0; i < left.length; i++) {
    const ch = left[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'" || ch === "`") quote = ch;
    else if (ch === "/" && left[i + 1] === "/") return null;
  }
  return quote;
}

/**
 * files: [{path, content}]. Returns {ok, path, content} or {ok:false, reason}.
 * Prefers the file the element was rendered from when the text appears in
 * several places.
 *
 * @param {{ path: string, content: string }[]} files
 * @param {{ before: string, after: string, file?: string }} req
 */
export function applyTextEdit(files, { before, after, file }) {
  if (typeof before !== "string" || typeof after !== "string")
    return { ok: false, reason: "bad-request" };
  if (before.trim() === after.trim()) return { ok: false, reason: "unchanged" };
  if (before.trim().length < 2) return { ok: false, reason: "too-short" };
  const re = pattern(before);
  if (!re) return { ok: false, reason: "empty" };
  const hits = [];
  for (const f of files) {
    for (const m of f.content.matchAll(re)) {
      // Words in a comment describe the content; they are not the content.
      if (inComment(f.content, m.index)) continue;
      hits.push({ f, start: m.index, end: m.index + m[0].length });
    }
  }
  if (!hits.length) return { ok: false, reason: "not-found" };
  let chosen = hits;
  if (hits.length > 1 && file) chosen = hits.filter((h) => h.f.path === file);
  if (chosen.length !== 1) return { ok: false, reason: "ambiguous" };
  const { f, start, end } = chosen[0];
  if (!wholeValue(f.path, f.content, start, end))
    return { ok: false, reason: "partial" };
  const encoded = encodeFor(f.path, f.content, start, after.trim());
  if (encoded === null) return { ok: false, reason: "needs-escaping" };
  return {
    ok: true,
    path: f.path,
    content: f.content.slice(0, start) + encoded + f.content.slice(end),
  };
}

/** Whether `index` sits in a line or block comment (JS/TS) or an HTML comment. */
export function inComment(source, index) {
  const lineStart = source.lastIndexOf("\n", index - 1) + 1;
  const left = source.slice(lineStart, index);
  if (/^\s*(\*|\/\/|\/\*)/.test(left) || /(^|[^:"'`])\/\//.test(left))
    return true;
  const open = source.lastIndexOf("/*", index);
  if (open !== -1 && source.indexOf("*/", open) > index) return true;
  const html = source.lastIndexOf("<!--", index);
  return html !== -1 && source.indexOf("-->", html) > index;
}

const TEST = /(^|\/)__tests__(\/|$)|\.(test|spec)\.[a-z]+$/;

export function sourceFiles(dir = "src", out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (
      SKIP.some((s) => path === s || path.startsWith(s + "/")) ||
      TEST.test(path)
    )
      continue;
    const st = statSync(path);
    if (st.isDirectory()) sourceFiles(path, out);
    else if (
      EXTS.has(extname(name)) &&
      !name.endsWith(".d.ts") &&
      st.size < 400_000
    ) {
      out.push({ path, content: readFileSync(path, "utf8") });
    }
  }
  return out;
}

/**
 * Applies several edits in order, each against the result of the last, all or
 * nothing. Returns the files that changed, or the first edit that couldn't be
 * made and why.
 *
 * @param {{ path: string, content: string }[]} files
 * @param {{ before: string, after: string, file?: string }[]} edits
 */
export function applyEdits(files, edits) {
  if (!Array.isArray(edits) || !edits.length || edits.length > 30)
    return { ok: false, reason: "bad-request" };
  let current = files;
  const changed = new Map();
  for (let i = 0; i < edits.length; i++) {
    const res = applyTextEdit(current, edits[i]);
    if (!res.ok) return { ok: false, reason: res.reason, index: i };
    changed.set(res.path, res.content);
    current = current.map((f) =>
      f.path === res.path ? { path: f.path, content: res.content } : f,
    );
  }
  return {
    ok: true,
    files: [...changed].map(([path, content]) => ({ path, content })),
  };
}

/** Whether a changed code or JSON file still parses. */
export async function syntaxOk(path, content) {
  if (extname(path) === ".json") {
    try {
      JSON.parse(content);
      return true;
    } catch {
      return false;
    }
  }
  if (![".ts", ".tsx", ".js", ".mjs", ".jsx"].includes(extname(path)))
    return true;
  try {
    const ts = (await import("typescript")).default;
    const kind = path.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const sf = ts.createSourceFile(
      path,
      content,
      ts.ScriptTarget.Latest,
      false,
      kind,
    );
    return sf.parseDiagnostics.length === 0;
  } catch {
    return true;
  }
}

/** Applies the edits to the site's source and writes the files, or writes nothing. */
export async function applyToSite(edits) {
  const res = applyEdits(sourceFiles(), edits);
  if (!res.ok) return res;
  for (const f of res.files)
    if (!(await syntaxOk(f.path, f.content)))
      return { ok: false, reason: "syntax" };
  for (const f of res.files) writeFileSync(f.path, f.content);
  return { ok: true, files: res.files.map((f) => f.path) };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  let result;
  try {
    const req = JSON.parse(
      Buffer.from(process.argv[2] ?? "", "base64").toString("utf8"),
    );
    result = await applyToSite(Array.isArray(req.edits) ? req.edits : [req]);
  } catch (e) {
    result = {
      ok: false,
      reason: "error",
      detail: String(e && e.message).slice(0, 200),
    };
  }
  process.stdout.write(JSON.stringify(result) + "\n");
}
