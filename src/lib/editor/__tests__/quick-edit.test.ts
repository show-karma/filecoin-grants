import { describe, expect, it } from "vitest";
import { SCHEMA, editsFrom, promptFor } from "../sandbox/quick-edit.mjs";

const blocks = [
  {
    id: 0,
    text: "Fund the commons",
    tag: "h1",
    file: "src/pages/index.astro",
    selected: false,
  },
  {
    id: 1,
    text: "Read",
    tag: "p",
    file: "src/pages/index.astro",
    selected: true,
  },
  {
    id: 2,
    text: "the plan",
    tag: "a",
    file: "src/pages/index.astro",
    selected: true,
  },
];

describe("promptFor", () => {
  it("numbers the text in page order and marks the selection", () => {
    const p = promptFor({ request: "Shorter", page: "/", blocks });
    expect(p).toContain("[0] <h1> Fund the commons");
    expect(p).toContain("[2] ★ <a> the plan");
    expect(p.trim().endsWith("Request: Shorter")).toBe(true);
  });
});

describe("editsFrom", () => {
  it("turns the model's answer into exact edits, with the source file", () => {
    expect(
      editsFrom(
        {
          action: "edit",
          summary: "x",
          edits: [{ id: 0, text: "  Fund   open source " }],
        },
        blocks,
      ),
    ).toEqual({
      ok: true,
      edits: [
        {
          id: 0,
          before: "Fund the commons",
          after: "Fund open source",
          file: "src/pages/index.astro",
        },
      ],
    });
  });

  it("hands requests the model passes on to the agent", () => {
    expect(
      editsFrom({ action: "agent", summary: "", edits: [] }, blocks),
    ).toEqual({
      ok: false,
      reason: "agent",
    });
  });

  it("rejects unknown or repeated blocks and text that isn't plain", () => {
    const bad = (edits: unknown[]) =>
      editsFrom({ action: "edit", summary: "", edits }, blocks);
    expect(bad([{ id: 9, text: "x" }]).ok).toBe(false);
    expect(
      bad([
        { id: 0, text: "a" },
        { id: 0, text: "b" },
      ]).ok,
    ).toBe(false);
    expect(bad([{ id: 0, text: "<b>bold</b>" }]).ok).toBe(false);
    expect(bad([{ id: 0, text: "{evil}" }]).ok).toBe(false);
    expect(bad([{ id: 0, text: "line\nbreak" }]).ok).toBe(true); // spacing is folded
  });

  it("treats an answer that changes nothing as a pass", () => {
    expect(
      editsFrom(
        {
          action: "edit",
          summary: "",
          edits: [{ id: 0, text: "Fund the commons" }],
        },
        blocks,
      ),
    ).toEqual({ ok: false, reason: "no-change" });
  });
});

describe("SCHEMA", () => {
  it("is closed, as structured outputs require", () => {
    expect(SCHEMA.additionalProperties).toBe(false);
    expect(SCHEMA.properties.edits.items.additionalProperties).toBe(false);
  });
});
