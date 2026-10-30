/* Browser side of /api/editor/*. */
import type { ChatItem } from "../../lib/editor/chat.ts";
import type { Card } from "../../lib/editor/cards.ts";

export type { Card };

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(`/api/editor/${path}`, {
    method: init.method ?? "GET",
    credentials: "same-origin",
    headers:
      init.body === undefined
        ? undefined
        : { "Content-Type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new ApiError(
      res.status,
      data.error ?? `Request failed (${res.status})`,
    );
  return data as T;
}

export function query(
  params: Record<string, string | number | null | undefined>,
): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params))
    if (v !== null && v !== undefined && v !== "") q.set(k, String(v));
  return q.toString();
}

export type SessionView = {
  state: "none" | "starting" | "ready" | "error";
  sandboxId?: string;
  previewUrl?: string;
  detail?: string;
  error?: string;
  log?: string;
  draft: { exists: boolean };
};

export type EventsResponse = {
  items: ChatItem[];
  cursor: string | null;
  more: boolean;
  run: { status: string; done: boolean } | null;
};

export type SaveResult = {
  saved: boolean;
  files: string[];
  skipped: string[];
  card?: Card;
};

export type PromptResult = {
  promptId: string;
  mode: "quick" | "deep";
  shotId: string | null;
};

export type TextEditResult = ({ ok: true } & SaveResult) | { ok: false };

export type TextEdit = { before: string; after: string; file?: string };

export type QuickEditResult =
  | {
      ok: true;
      edits: (TextEdit & { id: number })[];
      summary: string;
      ms: number;
    }
  | { ok: false; reason: string };

export type UploadResult = { path: string; url: string | null };

export type BuildStatus = {
  running: boolean;
  ok: boolean;
  exitCode: number | null;
  log: string;
};

export type ShipResult =
  | { published: true; prUrl: string; commit: string }
  | { published: false; review: true; prUrl: string }
  | { published: false; reason: string; prUrl?: string };

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
