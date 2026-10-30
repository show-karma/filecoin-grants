import { describe, expect, it } from "vitest";
import { describeChanges, isSha, parseRawDiff } from "../git-changes";

const A = "a".repeat(40);
const B = "b".repeat(40);
const Z = "0".repeat(40);

/** Builds `git diff --raw -z` output: header\0path\0 per record. */
const raw = (...records: [string, string][]) =>
  records.map(([h, p]) => `${h}\0${p}\0`).join("");

describe("parseRawDiff", () => {
  it("reads added, modified, deleted and executable files", () => {
    const out = raw(
      [`:000000 100644 ${Z} ${A} A`, "public/images/new.png"],
      [`:100644 100644 ${A} ${B} M`, "src/data/site.ts"],
      [`:100644 000000 ${A} ${Z} D`, "src/pages/old.astro"],
      [`:100644 100755 ${A} ${B} M`, "scripts/run.sh"],
    );
    expect(parseRawDiff(out)).toEqual([
      {
        kind: "write",
        path: "public/images/new.png",
        mode: "100644",
        blobSha: A,
      },
      { kind: "write", path: "src/data/site.ts", mode: "100644", blobSha: B },
      { kind: "delete", path: "src/pages/old.astro" },
      { kind: "write", path: "scripts/run.sh", mode: "100755", blobSha: B },
    ]);
  });

  it("keeps paths with spaces, quotes and unicode intact (that is what -z is for)", () => {
    const path = 'public/images/Team "photo" – café.jpg';
    expect(
      parseRawDiff(raw([`:000000 100644 ${Z} ${A} A`, path]))[0],
    ).toMatchObject({ path });
  });

  it("returns nothing for an empty diff", () => {
    expect(parseRawDiff("")).toEqual([]);
  });

  it("refuses submodules rather than publishing them silently", () => {
    expect(() =>
      parseRawDiff(raw([`:000000 160000 ${Z} ${A} A`, "vendor/lib"])),
    ).toThrow(/link or submodule/);
  });

  it("refuses symlinks", () => {
    expect(() =>
      parseRawDiff(raw([`:000000 120000 ${Z} ${A} A`, "public/x"])),
    ).toThrow(/link or submodule/);
  });

  it("refuses output it does not understand", () => {
    expect(() => parseRawDiff("fatal: bad revision\0")).toThrow(/Unexpected/);
  });
});

describe("isSha", () => {
  it("accepts only full lowercase hex object ids", () => {
    expect(isSha(A)).toBe(true);
    expect(isSha(A.toUpperCase())).toBe(false);
    expect(isSha(`${A.slice(0, 39)};`)).toBe(false);
    expect(isSha(`${A} && rm -rf /`)).toBe(false);
  });
});

describe("describeChanges", () => {
  it("lists a few files and counts the rest", () => {
    const changes = Array.from({ length: 8 }, (_, i) => ({
      kind: "write" as const,
      path: `f${i}.ts`,
      mode: "100644" as const,
      blobSha: A,
    }));
    expect(describeChanges(changes, 3)).toBe(
      "8 files: f0.ts, f1.ts, f2.ts, and 5 more",
    );
    expect(describeChanges([{ kind: "delete", path: "x.ts" }])).toBe(
      "1 file: x.ts (deleted)",
    );
  });
});
