// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  buildPrompt,
  editedFiles,
  htmlToMarkdown,
  humanize,
  pageMentioned,
  splitPrompt,
  stepFor,
  wordDiff,
} from "../util";

describe("prompts", () => {
  const item = {
    file: "src/components/PageHero.astro",
    loc: "25:80",
    tag: "h1",
    label: "Heading",
    text: "R&D",
    image: "",
    alt: "",
  };

  it("carry the selection as context, and the chat shows only what was typed", () => {
    const p = buildPrompt({
      text: "Make this bigger",
      page: "/rnd",
      items: [item],
      references: ["/home/user/attachments/a.png"],
      docs: [],
    });
    expect(p).toContain("src/components/PageHero.astro:25:80");
    expect(p).toContain("/home/user/attachments/a.png");
    expect(splitPrompt(p)).toEqual({
      text: "Make this bigger",
      extras: ["Heading", "1 image"],
    });
  });

  it("leave plain requests untouched", () => {
    expect(
      buildPrompt({
        text: "Hi",
        page: null,
        items: [],
        references: [],
        docs: [],
      }),
    ).toBe("Hi");
    expect(splitPrompt("Hi")).toEqual({ text: "Hi", extras: [] });
  });
});

describe("reading the agent's work", () => {
  it("turns activity into plain steps and files", () => {
    expect(stepFor("Edited src/data/site.ts")).toBe("Making the change");
    expect(stepFor("Looked at src/pages/rnd.astro")).toBe("Reading the site");
    expect(stepFor("Ran `curl -s localhost:4321/`")).toBe(
      "Checking the result",
    );
    expect(
      editedFiles([
        "Looked at a.ts",
        "Edited src/pages/rnd.astro",
        "Edited a file",
      ]),
    ).toEqual(["src/pages/rnd.astro"]);
  });

  it("finds the page a reply points at", () => {
    expect(
      pageMentioned("Updated the intro. Have a look at /rnd in the preview."),
    ).toBe("/rnd");
    expect(pageMentioned("Updated the hero / CTA spacing.")).toBeNull();
    expect(pageMentioned("Changed /kernel and /rnd")).toBe("/kernel");
    expect(pageMentioned("Edited src/data/site.ts")).toBeNull();
  });
});

describe("diffs that read like text", () => {
  it("pulls the words out of code lines", () => {
    expect(humanize('  title: "Filecoin is a network",')).toBe(
      "Filecoin is a network",
    );
    expect(humanize('<h2 class="x">Our <em>focus</em></h2>')).toBe("Our focus");
  });

  it("marks changed words", () => {
    const parts = wordDiff(
      "The work behind the network",
      "The money behind the network",
    );
    expect(
      parts.filter((p) => p.type !== "same").map((p) => `${p.type}:${p.text}`),
    ).toEqual(["removed:work", "added:money"]);
  });
});

describe("htmlToMarkdown", () => {
  it("keeps headings, lists, links and emphasis from a pasted document", () => {
    const md = htmlToMarkdown(
      '<h1>FAQ</h1><p>Read <a href="https://filpgf.io">this</a> <b>first</b>.</p><ul><li>One</li><li>Two</li></ul><style>p{}</style>',
    );
    expect(md).toBe(
      "# FAQ\n\nRead [this](https://filpgf.io) **first**.\n\n- One\n- Two",
    );
  });
});
