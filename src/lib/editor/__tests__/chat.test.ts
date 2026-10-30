import { describe, expect, it } from "vitest";
import {
  describeTool,
  foldStreaming,
  toChatItems,
  type ChatItem,
} from "../chat";
import type { BoatEvent } from "../boat";

let n = 0;
const ev = (
  type: string,
  data: Record<string, unknown>,
  taskId = "p1",
): BoatEvent => ({
  id: `e${++n}`,
  type,
  timestamp: 1_700_000_000_000 + n,
  taskId,
  data,
});

describe("describeTool", () => {
  it("says which file was edited, relative to the site", () => {
    expect(
      describeTool({
        name: "Edit",
        input: { file_path: "/home/user/site/src/data/site.ts" },
      }),
    ).toBe("Edited src/data/site.ts");
    expect(
      describeTool({
        name: "write_file",
        arguments: '{"path":"/home/user/site/public/a.png"}',
      }),
    ).toBe("Edited public/a.png");
  });

  it("summarises reads, searches and commands", () => {
    expect(
      describeTool({
        name: "Read",
        input: { file_path: "/home/user/site/src/pages/rnd.astro" },
      }),
    ).toBe("Looked at src/pages/rnd.astro");
    expect(describeTool({ name: "Grep", input: { pattern: "Kernel" } })).toBe(
      "Searched the site files",
    );
    expect(
      describeTool({
        name: "Bash",
        input: { command: "curl -s localhost:4321/rnd | head\nmore" },
      }),
    ).toBe("Ran `curl -s localhost:4321/rnd | head`");
  });

  it("reads Claude Code's nested {use, result} records", () => {
    expect(
      describeTool({
        use: {
          name: "Edit",
          input: { file_path: "/home/user/site/src/data/site.ts" },
        },
        result: { content: "ok" },
      }),
    ).toBe("Edited src/data/site.ts");
  });

  it("hides records without a tool name and to-do bookkeeping", () => {
    expect(describeTool({ output: "ok" })).toBeNull();
    expect(describeTool({ name: "TodoWrite", input: {} })).toBeNull();
  });
});

describe("toChatItems", () => {
  it("shows the prompt once and the end of the turn", () => {
    const items = toChatItems([
      ev("prompt", { prompt: "Change the title", status: "queued" }),
      ev("prompt", { prompt: "Change the title", status: "running" }),
      ev("prompt", { prompt: "Change the title", status: "finished" }),
    ]);
    const folded = foldStreaming(items);
    expect(folded.filter((i) => i.kind === "user")).toHaveLength(1);
    expect(folded.find((i) => i.kind === "status")).toMatchObject({
      status: "finished",
    });
  });

  it("turns tool calls into activity lines and text into replies", () => {
    const items = toChatItems([
      ev("response", {
        content: "",
        tools: [{ name: "Edit", input: { file_path: "/home/user/site/a.ts" } }],
      }),
      ev("response", { content: "Done. Look at /rnd." }),
    ]);
    expect(items.map((i) => i.kind)).toEqual(["activity", "assistant"]);
  });

  it("reports a failed prompt with its reason and usage limits as notices", () => {
    const items = toChatItems([
      ev("prompt", {
        prompt: "x",
        status: "failed",
        error: "model overloaded",
      }),
      ev("usage_limit", { message: "Monthly limit reached" }),
    ]);
    expect(items).toContainEqual(
      expect.objectContaining({
        kind: "status",
        status: "failed",
        error: "model overloaded",
      }),
    );
    expect(items).toContainEqual(
      expect.objectContaining({
        kind: "notice",
        text: "Monthly limit reached",
      }),
    );
  });

  it("ignores event types it does not know", () => {
    expect(toChatItems([ev("compaction_complete", {})])).toEqual([]);
  });
});

describe("foldStreaming", () => {
  const say = (text: string, streaming: boolean, key: string): ChatItem => ({
    kind: "assistant",
    key,
    promptId: "p1",
    text,
    streaming,
    at: 1,
  });

  it("joins delta partials into one message", () => {
    const out = foldStreaming([say("Upd", true, "a"), say("ating", true, "b")]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ text: "Updating", streaming: true });
  });

  it("replaces cumulative partials rather than repeating them", () => {
    const out = foldStreaming([
      say("Upd", true, "a"),
      say("Updating", true, "b"),
    ]);
    expect(out[0]).toMatchObject({ text: "Updating" });
  });

  it("lets the final message replace its partials", () => {
    const out = foldStreaming([
      say("Upd", true, "a"),
      say("ating", true, "b"),
      say("Updating the title.", false, "c"),
    ]);
    expect(out).toEqual([say("Updating the title.", false, "c")]);
  });

  it("drops partials pushed out by a tool call once the final text arrives", () => {
    const tool: ChatItem = {
      kind: "activity",
      key: "t",
      promptId: "p1",
      label: "Edited a.ts",
      at: 1,
    };
    const out = foldStreaming([
      say("Let me", true, "a"),
      tool,
      say("Let me fix that. Done.", false, "c"),
    ]);
    expect(out.map((i) => i.key)).toEqual(["t", "c"]);
  });

  it("is idempotent over repeated items", () => {
    const item = say("Hi", false, "a");
    expect(foldStreaming([item, item])).toHaveLength(1);
  });
});
