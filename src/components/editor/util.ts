/* Browser-side helpers for the editor. Pure where possible, so they are tested. */

export const PAGES = [
  { path: "/", label: "Home" },
  { path: "/kernel", label: "Kernel" },
  { path: "/rnd", label: "R&D" },
  { path: "/revenue-development", label: "Revenue Development" },
  { path: "/propgf", label: "ProPGF" },
  { path: "/roadmap", label: "Roadmap" },
  { path: "/blog", label: "Blog" },
];

export function pageLabel(path: string | null | undefined): string {
  if (!path) return "";
  const known = PAGES.find((p) => p.path === path);
  if (known) return known.label;
  if (path.startsWith("/blog/")) return "Blog post";
  return path;
}

/** An element picked in the preview, as the overlay describes it. */
export type PickedItem = {
  file: string;
  loc: string;
  tag: string;
  label: string;
  text: string;
  image: string;
  alt: string;
};

export type Attachment =
  | {
      id: string;
      kind: "image";
      name: string;
      mime: string;
      data: string;
      preview: string;
    }
  | { id: string; kind: "doc"; title: string; markdown: string; words: number };

/** Marks where the editor's context starts in a prompt, so the chat shows only what was typed. */
export const CONTEXT_MARK = "\n\n— Editor context —\n";

export function buildPrompt(input: {
  text: string;
  page: string | null;
  items: PickedItem[];
  references: string[];
  docs: { title: string; markdown: string }[];
}): string {
  const lines: string[] = [];
  if (input.page)
    lines.push(
      `The person is looking at ${input.page} (${pageLabel(input.page)}) in the preview.`,
    );
  if (input.items.length) {
    lines.push(
      input.items.length === 1
        ? "They selected this element in the preview:"
        : "They selected these elements in the preview:",
    );
    input.items.forEach((it, i) => {
      const what = it.text
        ? ` “${it.text}”`
        : it.alt
          ? ` (image: “${it.alt}”)`
          : "";
      const img = it.image ? ` src=${it.image}` : "";
      lines.push(
        `${i + 1}. ${it.label} <${it.tag}>${what}${img} — rendered at ${it.file}:${it.loc}`,
      );
    });
    lines.push(
      "“This”, “here” and “these” in the request refer to the selection.",
    );
  }
  for (const r of input.references) {
    lines.push(
      `They attached a reference image at ${r}. Look at it before you start.`,
    );
  }
  for (const d of input.docs) {
    lines.push(
      `They pasted a document (“${d.title}”). Use its content as written:\n\n${d.markdown}`,
    );
  }
  return lines.length
    ? `${input.text.trim()}${CONTEXT_MARK}${lines.join("\n")}`
    : input.text.trim();
}

/** What the person typed, and a few words about what was attached. */
export function splitPrompt(prompt: string): {
  text: string;
  extras: string[];
} {
  const i = prompt.indexOf(CONTEXT_MARK);
  if (i === -1) return { text: prompt, extras: [] };
  const ctx = prompt.slice(i + CONTEXT_MARK.length);
  const extras: string[] = [];
  const selected = ctx.match(/^\d+\. (\w[\w ]*) </gm);
  if (selected)
    extras.push(
      selected.length === 1
        ? selected[0].replace(/^\d+\. | <$/g, "")
        : `${selected.length} elements`,
    );
  const refs = ctx.match(/reference image/g);
  if (refs)
    extras.push(refs.length === 1 ? "1 image" : `${refs.length} images`);
  const docs = ctx.match(/pasted a document/g);
  if (docs)
    extras.push(docs.length === 1 ? "1 document" : `${docs.length} documents`);
  return { text: prompt.slice(0, i), extras };
}

/** Plain-English step for one agent activity line. */
export function stepFor(label: string): string {
  if (/^Edited/.test(label)) return "Making the change";
  if (/^Ran/.test(label)) return "Checking the result";
  if (/online/.test(label)) return "Looking something up";
  if (/browser/.test(label)) return "Checking the page";
  if (/^Looked at|^Searched/.test(label)) return "Reading the site";
  return "Working";
}

/** Files the agent edited, from its activity lines. */
export function editedFiles(labels: string[]): string[] {
  const out = new Set<string>();
  for (const l of labels) {
    const m = /^Edited (\S+)/.exec(l);
    if (m && m[1] !== "a") out.add(m[1]);
  }
  return [...out];
}

/** A page the reply points at ("…on /rnd"), if it is one of the site's. */
export function pageMentioned(text: string): string | null {
  // A path with a name after the slash; a bare "/" is too often just a slash.
  for (const m of text.matchAll(
    /(?:^|[\s(“"'])(\/[a-z0-9][a-z0-9-]*)(?=[\s).,;:”"'!?]|$)/gi,
  )) {
    if (PAGES.some((p) => p.path === m[1])) return m[1];
  }
  return null;
}

// ---- diffs that read like text, not code -------------------------------------

/** The human part of a source line: a string literal's contents, or text between tags. */
export function humanize(line: string): string {
  const t = line.trim();
  const quoted =
    /^[\w$.[\]"'-]*\s*[:=]\s*(["'`])(.*)\1,?;?$/.exec(t) ??
    /^(["'`])(.*)\1,?$/.exec(t);
  if (quoted) return quoted[2].replace(/\\(["'`\\])/g, "$1");
  return t
    .replace(/<[^>]*>/g, " ")
    .replace(/\{[^}]*\}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type WordPart = { text: string; type: "same" | "removed" | "added" };

/** Word-level diff (longest common subsequence), for before/after text. */
export function wordDiff(before: string, after: string): WordPart[] {
  const a = before.split(/(\s+)/).filter((w) => w !== "");
  const b = after.split(/(\s+)/).filter((w) => w !== "");
  if (a.length * b.length > 250_000) {
    return [
      { text: before, type: "removed" },
      { text: after, type: "added" },
    ];
  }
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i][j] =
        a[i] === b[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: WordPart[] = [];
  const push = (text: string, type: WordPart["type"]) => {
    const last = out[out.length - 1];
    if (last && last.type === type) last.text += text;
    else out.push({ text, type });
  };
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push(a[i], "same");
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) push(a[i++], "removed");
    else push(b[j++], "added");
  }
  while (i < a.length) push(a[i++], "removed");
  while (j < b.length) push(b[j++], "added");
  return out;
}

// ---- pasted documents ------------------------------------------------------------

/** Clipboard HTML (Google Docs, Word, web pages) to compact Markdown. */
export function htmlToMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const walk = (node: Node, listDepth = 0): string => {
    if (node.nodeType === Node.TEXT_NODE)
      return (node.textContent ?? "").replace(/\s+/g, " ");
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const el = node as HTMLElement;
    const inner = () =>
      [...el.childNodes].map((c) => walk(c, listDepth)).join("");
    const style = el.getAttribute("style") ?? "";
    switch (el.tagName) {
      case "H1":
        return `\n\n# ${inner().trim()}\n\n`;
      case "H2":
        return `\n\n## ${inner().trim()}\n\n`;
      case "H3":
      case "H4":
      case "H5":
      case "H6":
        return `\n\n### ${inner().trim()}\n\n`;
      case "P":
      case "DIV":
        return `\n\n${inner().trim()}\n\n`;
      case "BR":
        return "\n";
      case "UL":
      case "OL":
        return `\n${[...el.children]
          .map(
            (li, i) =>
              `${"  ".repeat(listDepth)}${el.tagName === "OL" ? `${i + 1}.` : "-"} ${[
                ...li.childNodes,
              ]
                .map((c) => walk(c, listDepth + 1))
                .join("")
                .trim()}`,
          )
          .join("\n")}\n`;
      case "A": {
        const href = el.getAttribute("href");
        const text = inner().trim();
        return href && /^https?:/.test(href) ? `[${text}](${href})` : text;
      }
      case "B":
      case "STRONG":
        return `**${inner().trim()}**`;
      case "I":
      case "EM":
        return `*${inner().trim()}*`;
      case "SPAN":
        if (/font-weight:\s*(700|bold)/.test(style))
          return `**${inner().trim()}**`;
        if (/font-style:\s*italic/.test(style)) return `*${inner().trim()}*`;
        return inner();
      case "STYLE":
      case "SCRIPT":
      case "META":
        return "";
      default:
        return inner();
    }
  };
  return walk(doc.body)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ---- images ----------------------------------------------------------------------

/** Shrinks a photo for upload: longest side 2000 px, JPEG (or PNG when it has transparency). */
export async function shrinkImage(
  blob: Blob,
  maxSide = 2000,
): Promise<{ data: string; mime: string }> {
  const keep =
    blob.type === "image/gif" ||
    (blob.size < 350_000 && /image\/(png|jpeg|webp)/.test(blob.type));
  if (keep) return { data: await toBase64(blob), mime: blob.type };
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const mime = blob.type === "image/png" ? "image/png" : "image/jpeg";
  const out = await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b!), mime, 0.85),
  );
  return { data: await toBase64(out), mime };
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function timeAgo(at: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return `${h} h ago`;
}
