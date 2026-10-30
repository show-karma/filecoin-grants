/*
 * Turns Boat agent events into chat items for the editor UI.
 *
 * Boat's event payloads are deliberately loose ("branch on type, expect extra
 * fields"), and the tool records differ per agent harness. So this reads them
 * defensively and falls back to something plain rather than failing. Pure, so
 * it is tested without a sandbox.
 */
import type { BoatEvent } from "./boat.ts";

export type AssistantItem = {
  kind: "assistant";
  key: string;
  promptId: string | null;
  text: string;
  streaming: boolean;
  at: number;
};

export type ChatItem =
  | {
      kind: "user";
      key: string;
      promptId: string | null;
      text: string;
      at: number;
    }
  | AssistantItem
  | {
      kind: "activity";
      key: string;
      promptId: string | null;
      label: string;
      at: number;
    }
  | {
      kind: "status";
      key: string;
      promptId: string | null;
      status: "finished" | "failed" | "interrupted";
      error?: string;
      at: number;
    }
  | {
      kind: "notice";
      key: string;
      promptId: string | null;
      text: string;
      at: number;
    };

const SITE_DIR = /^\/?home\/user\/site\//;

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function shortPath(path: string): string {
  return path.replace(SITE_DIR, "").replace(/^~\/site\//, "");
}

function toolInput(tool: Record<string, any>): Record<string, any> {
  const raw =
    tool.input ??
    tool.args ??
    tool.arguments ??
    tool.parameters ??
    tool.function?.arguments;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return { command: raw };
    }
  }
  return raw && typeof raw === "object" ? raw : {};
}

/** One plain-English line per tool call, or null for records to hide. */
export function describeTool(raw: Record<string, any>): string | null {
  // Claude Code on Boat nests each call as {use: {name, input}, result}.
  const tool = raw.use && typeof raw.use === "object" ? raw.use : raw;
  const name =
    str(tool.name) ??
    str(tool.tool) ??
    str(tool.toolName) ??
    str(tool.function?.name);
  // Results, outputs and bookkeeping records carry no name: the call they
  // belong to was already shown.
  if (!name) return null;
  if (/todo|task_?list|plan/i.test(name)) return null;
  const input = toolInput(tool);
  const path =
    str(input.file_path) ??
    str(input.path) ??
    str(input.filePath) ??
    str(input.notebook_path);
  const where = path ? ` ${shortPath(path)}` : "";
  if (/edit|write|patch|replace|create|apply/i.test(name))
    return `Edited${where || " a file"}`;
  if (/read|view|open|cat/i.test(name)) return `Looked at${where || " a file"}`;
  if (/grep|glob|search|find|^ls$|list/i.test(name))
    return "Searched the site files";
  if (/fetch|web|browse|http/i.test(name)) return "Looked something up online";
  if (/screenshot|computer|browser/i.test(name))
    return "Checked the page in a browser";
  if (/bash|shell|exec|command|terminal|run/i.test(name)) {
    const cmd = str(input.command) ?? str(input.cmd);
    return cmd ? `Ran \`${cmd.split("\n")[0].slice(0, 80)}\`` : "Ran a command";
  }
  return `Used ${name}`;
}

const TERMINAL = new Set(["finished", "failed", "interrupted"]);

export function toChatItems(events: BoatEvent[]): ChatItem[] {
  const items: ChatItem[] = [];
  for (const event of events) {
    const data = (event.data ?? {}) as Record<string, any>;
    const promptId = event.taskId ?? null;
    const at = event.timestamp;
    switch (event.type) {
      case "prompt": {
        const status = str(data.status);
        // Every status change of a prompt is its own event. The text is shown
        // once, keyed by prompt, and the end of the turn once more.
        const text = str(data.prompt);
        if (text)
          items.push({
            kind: "user",
            key: `user:${promptId ?? event.id}`,
            promptId,
            text,
            at,
          });
        if (status && TERMINAL.has(status)) {
          items.push({
            kind: "status",
            key: `status:${promptId ?? event.id}`,
            promptId,
            status: status as "finished" | "failed" | "interrupted",
            error: str(data.error),
            at,
          });
        }
        break;
      }
      case "response": {
        const tools = Array.isArray(data.tools) ? data.tools : [];
        tools.forEach((tool: Record<string, any>, i: number) => {
          const label =
            tool && typeof tool === "object" ? describeTool(tool) : null;
          if (label)
            items.push({
              kind: "activity",
              key: `tool:${event.id}:${i}`,
              promptId,
              label,
              at,
            });
        });
        const text = str(data.content);
        if (text) {
          items.push({
            kind: "assistant",
            key: `say:${event.id}`,
            promptId,
            text,
            streaming: data.is_streaming === true,
            at,
          });
        }
        break;
      }
      case "steer": {
        const text = str(data.message);
        if (text)
          items.push({
            kind: "user",
            key: `steer:${event.id}`,
            promptId,
            text,
            at,
          });
        break;
      }
      case "usage_limit": {
        const text =
          str(data.message) ??
          str(data.error) ??
          "The AI service's usage limit was reached.";
        items.push({
          kind: "notice",
          key: `limit:${event.id}`,
          promptId,
          text,
          at,
        });
        break;
      }
      default:
        break;
    }
  }
  return items;
}

/**
 * Folds streaming partials into what the chat should show right now: final
 * replies stay, and the partials of a reply still being written collapse into
 * one growing message. Works whether the harness sends partials as deltas or
 * as the whole text so far.
 */
export function foldStreaming(items: ChatItem[]): ChatItem[] {
  const out: ChatItem[] = [];
  let draft: AssistantItem | null = null;
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.key)) continue;
    seen.add(item.key);
    if (item.kind === "assistant" && item.streaming) {
      const current = draft as AssistantItem | null;
      if (current && current.promptId === item.promptId) {
        const merged: string = item.text.startsWith(current.text)
          ? item.text
          : current.text + item.text;
        draft = { ...current, text: merged };
      } else {
        if (current) out.push(current);
        draft = { ...item, key: `draft:${item.key}` };
      }
      continue;
    }
    if (item.kind === "assistant") {
      // The final message replaces the partials that led up to it, including
      // any that a tool call in between already pushed out.
      draft = null;
      const head = item.text.slice(0, 40);
      for (let i = out.length - 1; i >= 0; i--) {
        const prev = out[i];
        if (prev.kind === "assistant" && !prev.streaming) break;
        if (
          prev.kind === "assistant" &&
          prev.promptId === item.promptId &&
          (item.text.includes(prev.text.slice(0, 40)) ||
            prev.text.startsWith(head))
        ) {
          out.splice(i, 1);
        }
      }
    } else if (
      draft &&
      (item.kind === "activity" ||
        item.kind === "status" ||
        item.kind === "notice")
    ) {
      out.push(draft);
      draft = null;
    }
    out.push(item);
  }
  if (draft) out.push(draft);
  return out;
}
