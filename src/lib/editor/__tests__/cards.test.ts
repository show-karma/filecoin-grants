import { describe, expect, it } from "vitest";
import {
  cardTitle,
  foldCards,
  isPagePath,
  pageForFile,
  parseUnifiedDiff,
} from "../cards";
import { chooseMode } from "../mode";

describe("parseUnifiedDiff", () => {
  it("collects removed and added lines per file", () => {
    const diff = [
      "diff --git a/src/data/landing.ts b/src/data/landing.ts",
      "--- a/src/data/landing.ts",
      "+++ b/src/data/landing.ts",
      "@@ -3 +3 @@",
      '-  title: "Old",',
      '+  title: "New",',
      "diff --git a/public/images/x.png b/public/images/x.png",
      "Binary files /dev/null and b/public/images/x.png differ",
    ].join("\n");
    expect(parseUnifiedDiff(diff)).toEqual([
      {
        file: "src/data/landing.ts",
        removed: ['  title: "Old",'],
        added: ['  title: "New",'],
      },
      {
        file: "public/images/x.png",
        removed: [],
        added: ["(image or other file)"],
      },
    ]);
  });
});

describe("foldCards", () => {
  it("applies patches and skips junk lines", () => {
    const card = {
      id: "a1",
      commit: "c",
      prev: "p",
      title: "T",
      at: 2,
      undone: false,
      focus: null,
    };
    const jsonl = [
      JSON.stringify(card),
      "not json",
      JSON.stringify({
        id: "a1",
        patch: { undone: true, focus: { y: 10, h: 5 } },
      }),
      JSON.stringify({ id: "b2", commit: "d", at: 1 }),
    ].join("\n");
    const cards = foldCards(jsonl);
    expect(cards.map((c) => c.id)).toEqual(["b2", "a1"]);
    expect(cards[1]).toMatchObject({ undone: true, focus: { y: 10, h: 5 } });
  });
});

describe("pages", () => {
  it("maps page files to routes", () => {
    expect(pageForFile("src/pages/index.astro")).toBe("/");
    expect(pageForFile("src/pages/rnd.astro")).toBe("/rnd");
    expect(pageForFile("src/pages/blog/index.astro")).toBe("/blog");
    expect(pageForFile("src/pages/blog/[...slug].astro")).toBeNull();
    expect(pageForFile("src/data/site.ts")).toBeNull();
  });

  it("accepts only plain paths", () => {
    expect(isPagePath("/rnd")).toBe(true);
    expect(isPagePath("https://evil")).toBe(false);
    expect(isPagePath("/a b")).toBe(false);
    expect(isPagePath("/x;rm")).toBe(false);
  });

  it("titles from the first line", () => {
    expect(cardTitle("Change the headline\n\n— Editor context —")).toBe(
      "Change the headline",
    );
  });
});

describe("chooseMode", () => {
  it("is quick for small pointed edits", () => {
    expect(chooseMode("Fix the typo in the heading", false)).toBe("quick");
    expect(chooseMode("Make this shorter", true)).toBe("quick");
    expect(chooseMode("Change the deadline to 12 December", false)).toBe(
      "quick",
    );
  });

  it("is thorough for structure, and when unsure", () => {
    expect(chooseMode("Add a new section with three cards", true)).toBe("deep");
    expect(chooseMode("Redesign the header", false)).toBe("deep");
    expect(chooseMode("Can you look into why this looks odd", false)).toBe(
      "deep",
    );
    expect(chooseMode("x".repeat(400), true)).toBe("deep");
  });
});
