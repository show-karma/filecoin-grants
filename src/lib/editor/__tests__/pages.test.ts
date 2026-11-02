import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { cleanPages, parseDraftLog } from "../workspace";
import { DRAFT_LOG_COMMAND, PAGES_COMMAND } from "../sandbox-scripts";

const parses = (script: string) =>
  execFileSync("bash", ["-n"], {
    input: script,
    stdio: ["pipe", "pipe", "pipe"],
  });

describe("page listing", () => {
  it("commands are valid bash", () => {
    expect(() => parses(PAGES_COMMAND)).not.toThrow();
    expect(() => parses(DRAFT_LOG_COMMAND)).not.toThrow();
  });

  it("lists this site's pages with their titles, skipping routes the editor hides", () => {
    const out = execFileSync("node", ["src/lib/editor/sandbox/pages.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    const pages = cleanPages(JSON.parse(out));
    const paths = pages.map((p) => p.path);
    expect(paths).toContain("/");
    expect(paths).toContain("/kernel");
    expect(paths).toContain("/blog");
    expect(paths).not.toContain("/edit");
    expect(paths.some((p) => p.includes("["))).toBe(false);
    expect(pages.find((p) => p.path === "/revenue-development")?.label).toBe(
      "Revenue Development",
    );
  });

  it("drops malformed entries", () => {
    expect(
      cleanPages([
        { path: "/events", label: " Events " },
        { path: "events", label: "no slash" },
        { path: "/x", label: "" },
        { path: "/y;rm", label: "shell" },
        null,
      ]),
    ).toEqual([{ path: "/events", label: "Events" }]);
    expect(cleanPages("nope")).toEqual([]);
  });
});

describe("draft log", () => {
  const sha = (c: string) => c.repeat(40);
  it("parses one commit per line, oldest first", () => {
    const out = [
      [sha("a"), "Mahesh", "1761750000", "Renamed Programs funded"].join(
        "\x1f",
      ),
      [sha("b"), "Erin", "1761760000", "Text: “A” → “B”"].join("\x1f"),
      "",
    ].join("\n");
    expect(parseDraftLog(out)).toEqual([
      {
        sha: sha("a"),
        author: "Mahesh",
        at: 1761750000,
        title: "Renamed Programs funded",
      },
      {
        sha: sha("b"),
        author: "Erin",
        at: 1761760000,
        title: "Text: “A” → “B”",
      },
    ]);
  });
  it("is empty when the branch does not exist", () => {
    expect(parseDraftLog("")).toEqual([]);
    expect(parseDraftLog("fatal: bad revision\n")).toEqual([]);
  });
});
