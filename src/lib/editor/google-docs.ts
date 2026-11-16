/*
 * Google Docs links in a request. People paste a link to the document that
 * holds the new copy; the agent in the sandbox would then have to fetch it
 * itself, slowly and often without access. The editor fetches the text here
 * instead and hands it over with the request, or says plainly that the
 * document is private.
 */

const DOC_LINK =
  /https?:\/\/docs\.google\.com\/document\/d\/([A-Za-z0-9_-]{20,})[^\s)>\]'"]*/g;
const MAX_DOCS = 3;
const MAX_CHARS = 60_000;
const TIMEOUT_MS = 10_000;

export type LinkedDoc = { url: string; id: string };

export type FetchedDoc =
  | { ok: true; title: string; text: string; truncated: boolean }
  | { ok: false; reason: "private" | "not-found" | "unreachable" };

export function findGoogleDocs(text: string): LinkedDoc[] {
  const seen = new Set<string>();
  const docs: LinkedDoc[] = [];
  for (const m of text.matchAll(DOC_LINK)) {
    if (seen.has(m[1])) continue;
    seen.add(m[1]);
    docs.push({ url: m[0], id: m[1] });
    if (docs.length === MAX_DOCS) break;
  }
  return docs;
}

export function exportUrl(id: string): string {
  return `https://docs.google.com/document/d/${id}/export?format=txt`;
}

export async function fetchGoogleDoc(
  id: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FetchedDoc> {
  let res: Response;
  try {
    res = await fetchImpl(exportUrl(id), {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: "text/plain" },
    });
  } catch {
    return { ok: false, reason: "unreachable" };
  }
  // A document that is not shared with "anyone with the link" redirects to
  // the Google sign-in page instead of answering.
  if (res.status >= 300 && res.status < 400)
    return { ok: false, reason: "private" };
  if (res.status === 401 || res.status === 403)
    return { ok: false, reason: "private" };
  if (res.status === 404) return { ok: false, reason: "not-found" };
  if (!res.ok) return { ok: false, reason: "unreachable" };
  const type = res.headers.get("content-type") ?? "";
  if (/text\/html/i.test(type)) return { ok: false, reason: "private" };
  const raw = (await res.text()).replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const truncated = raw.length > MAX_CHARS;
  const text = (truncated ? raw.slice(0, MAX_CHARS) : raw).trim();
  const title = (text.split("\n").find((l) => l.trim()) ?? "Document")
    .trim()
    .slice(0, 80);
  return { ok: true, title, text, truncated };
}

export const CONTEXT_MARK = "\n\n— Editor context —\n";

/** Lines for the agent about each linked document, in the request's context block. */
export function describeDoc(doc: LinkedDoc, fetched: FetchedDoc): string {
  if (fetched.ok) {
    const note = fetched.truncated ? " (only the first part; it is long)" : "";
    return (
      `They linked a Google Doc (“${fetched.title}”, ${doc.url}). The editor already fetched it${note}; ` +
      `use its text as written and do not fetch it yourself:\n\n${fetched.text}`
    );
  }
  const why =
    fetched.reason === "private"
      ? "it is not shared publicly, so it could not be read"
      : fetched.reason === "not-found"
        ? "the link does not open a document"
        : "it could not be reached right now";
  return (
    `They linked a Google Doc (${doc.url}) but ${why}. Do not try to fetch it. ` +
    `Ask them to paste the document's text into the chat` +
    (fetched.reason === "private"
      ? ', or to share it so that "Anyone with the link" can view it.'
      : ".")
  );
}

/**
 * The request with every linked Google Doc fetched and appended to its
 * context block. Links are only looked for in what the person typed, not in
 * context the editor added.
 */
export async function withGoogleDocs(
  prompt: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const mark = prompt.indexOf(CONTEXT_MARK);
  const typed = mark === -1 ? prompt : prompt.slice(0, mark);
  const docs = findGoogleDocs(typed);
  if (!docs.length) return prompt;
  const lines = await Promise.all(
    docs.map(async (d) =>
      describeDoc(d, await fetchGoogleDoc(d.id, fetchImpl)),
    ),
  );
  return mark === -1
    ? `${prompt}${CONTEXT_MARK}${lines.join("\n")}`
    : `${prompt}\n${lines.join("\n")}`;
}
