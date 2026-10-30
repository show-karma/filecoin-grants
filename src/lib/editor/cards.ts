/*
 * Change cards: one per saved change, shown in the editor's timeline with a
 * before/after, a "Show me" and an Undo.
 *
 * They live as JSON lines in the sandbox (~/.editor/changes.jsonl): a card
 * line when a change is saved, and patch lines ({id, patch}) after, such as
 * "undone". Pure helpers here; workspace.ts does the I/O.
 */

export type DiffHunk = { file: string; removed: string[]; added: string[] };

export type Card = {
  id: string;
  kind: "agent" | "text" | "undo";
  title: string;
  /** The page the change is on, for "Show me" and screenshots. */
  page: string | null;
  /** Where on that page (document y and height), from the preview's change detection. */
  focus: { y: number; h: number } | null;
  files: string[];
  hunks: DiffHunk[];
  shots: { before: boolean; after: boolean };
  /** Local commits in the sandbox: the save before this one, and this one. */
  prev: string;
  commit: string;
  promptId: string | null;
  undoOf: string | null;
  undone: boolean;
  at: number;
};

/** Parses `git diff --unified=N` into per-file runs of removed and added lines. */
export function parseUnifiedDiff(diff: string, maxHunks = 12): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  let file = "";
  let current: DiffHunk | null = null;
  const flush = () => {
    if (current && (current.removed.length || current.added.length))
      hunks.push(current);
    current = null;
  };
  for (const line of diff.split("\n")) {
    if (line.startsWith("diff --git ")) {
      flush();
      const m = / b\/(.+)$/.exec(line);
      file = m ? m[1] : "";
    } else if (line.startsWith("@@")) {
      flush();
      current = { file, removed: [], added: [] };
    } else if (current && line.startsWith("-") && !line.startsWith("---")) {
      current.removed.push(line.slice(1));
    } else if (current && line.startsWith("+") && !line.startsWith("+++")) {
      current.added.push(line.slice(1));
    } else if (line.startsWith("Binary files")) {
      flush();
      hunks.push({ file, removed: [], added: ["(image or other file)"] });
    }
    if (hunks.length >= maxHunks) break;
  }
  flush();
  return hunks.slice(0, maxHunks).map((h) => ({
    file: h.file,
    removed: h.removed.slice(0, 8).map((l) => l.slice(0, 400)),
    added: h.added.slice(0, 8).map((l) => l.slice(0, 400)),
  }));
}

/** Folds the card log: card lines in order, patch lines applied to them. */
export function foldCards(jsonl: string): Card[] {
  const cards = new Map<string, Card>();
  for (const raw of jsonl.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    let entry: unknown;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.id !== "string") continue;
    if (e.patch && typeof e.patch === "object") {
      const card = cards.get(e.id);
      if (card)
        cards.set(e.id, {
          ...card,
          ...(e.patch as Partial<Card>),
          id: card.id,
        });
    } else if (typeof e.commit === "string") {
      cards.set(e.id, e as unknown as Card);
    }
  }
  return [...cards.values()].sort((a, b) => a.at - b.at);
}

/** A short title from what someone asked for. */
export function cardTitle(request: string): string {
  const firstLine = request.split("\n")[0].replace(/\s+/g, " ").trim();
  return firstLine.length > 90
    ? `${firstLine.slice(0, 89)}…`
    : firstLine || "Change";
}

/** Page files map to routes, so the preview can go where the change is. */
export function pageForFile(file: string): string | null {
  const m = /^src\/pages\/(.+)\.(astro|md|mdx)$/.exec(file);
  if (!m || m[1].includes("[") || m[1].startsWith("api/")) return null;
  const route = m[1] === "index" ? "/" : `/${m[1].replace(/\/index$/, "")}`;
  return route;
}

export function isPagePath(value: unknown): value is string {
  // Not "//host": that is another site, not a page.
  return (
    typeof value === "string" &&
    /^\/(?![/\\])[A-Za-z0-9/_.-]{0,200}$/.test(value)
  );
}
