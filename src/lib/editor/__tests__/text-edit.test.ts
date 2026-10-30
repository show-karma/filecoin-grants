import { describe, expect, it } from "vitest";
import {
  SKIP,
  applyEdits,
  applyTextEdit,
  encodeFor,
  inComment,
} from "../sandbox/text-edit.mjs";
import { PROTECTED_DIRS, PROTECTED_FILES } from "../sandbox-scripts";

const files = (...pairs: [string, string][]) =>
  pairs.map(([path, content]) => ({ path, content }));

describe("applyTextEdit", () => {
  it("replaces text in a data file, inside its string literal", () => {
    const res = applyTextEdit(
      files([
        "src/data/landing.ts",
        'export const HERO = {\n  title: "The work behind the network, in the open.",\n};\n',
      ]),
      {
        before: "The work behind the network, in the open.",
        after: "Filecoin is a decentralized network for files.",
      },
    );
    expect(res).toMatchObject({ ok: true, path: "src/data/landing.ts" });
    expect(res.content).toContain(
      'title: "Filecoin is a decentralized network for files."',
    );
  });

  it("matches text that the source wraps across lines", () => {
    const src =
      '<p class="lead">\n  Filecoin\'s public goods funding puts capital\n  behind the infrastructure.\n</p>\n';
    const res = applyTextEdit(files(["src/pages/index.astro", src]), {
      before:
        "Filecoin's public goods funding puts capital behind the infrastructure.",
      after: "Funding the infrastructure Filecoin runs on.",
    });
    expect(res.ok).toBe(true);
    expect(res.content).toContain(
      '<p class="lead">\n  Funding the infrastructure Filecoin runs on.\n</p>',
    );
  });

  it("finds text written with HTML entities", () => {
    const res = applyTextEdit(
      files(["src/pages/rnd.astro", "<h2>Research &amp; Development</h2>\n"]),
      {
        before: "Research & Development",
        after: "R&D programme",
      },
    );
    expect(res.ok).toBe(true);
    expect(res.content).toBe("<h2>R&D programme</h2>\n");
  });

  it("escapes the quote of the surrounding string", () => {
    const res = applyTextEdit(
      files(["src/data/site.ts", "export const A = 'Apply today';\n"]),
      {
        before: "Apply today",
        after: "Don't wait, apply",
      },
    );
    expect(res.ok).toBe(true);
    expect(res.content).toBe("export const A = 'Don\\'t wait, apply';\n");
  });

  it("refuses when the text appears more than once, unless the element's file decides it", () => {
    const set = files(
      ["src/pages/a.astro", "<p>Apply now</p>"],
      ["src/pages/b.astro", "<p>Apply now</p>"],
    );
    expect(applyTextEdit(set, { before: "Apply now", after: "Apply" })).toEqual(
      { ok: false, reason: "ambiguous" },
    );
    expect(
      applyTextEdit(set, {
        before: "Apply now",
        after: "Apply",
        file: "src/pages/b.astro",
      }),
    ).toMatchObject({
      ok: true,
      path: "src/pages/b.astro",
    });
  });

  it("ignores mentions in comments, so the one real use is found", () => {
    const src = [
      "/**",
      ' * "Committed to date" is the API total.',
      " */",
      'export const STATS = [{ label: "Committed to date" }]; // not "Committed to date" here',
      '/* "Committed to date" again */',
    ].join("\n");
    const res = applyTextEdit(files(["src/data/landing.ts", src]), {
      before: "Committed to date",
      after: "Committed so far",
    });
    expect(res.ok).toBe(true);
    expect(res.content).toContain(
      'label: "Committed so far" }]; // not "Committed to date" here',
    );
    expect(res.content).toContain(' * "Committed to date" is the API total.');
  });

  it("refuses text it can't find, and new text that would open markup", () => {
    expect(
      applyTextEdit(files(["src/pages/a.astro", "<p>Hello</p>"]), {
        before: "Goodbye",
        after: "x",
      }),
    ).toMatchObject({
      ok: false,
      reason: "not-found",
    });
    expect(
      applyTextEdit(files(["src/pages/a.astro", "<p>Hello world</p>"]), {
        before: "Hello world",
        after: "<script>x</script>",
      }),
    ).toMatchObject({ ok: false, reason: "needs-escaping" });
  });
});

describe("only whole values", () => {
  it("refuses part of a path, a class or a longer sentence", () => {
    const set = files([
      "src/pages/a.astro",
      '<a href="/rnd/apply-now" class="apply">Read the guide before you apply now</a>',
    ]);
    expect(applyTextEdit(set, { before: "apply", after: "x" })).toMatchObject({
      ok: false,
    });
    expect(
      applyTextEdit(set, { before: "apply now", after: "join" }),
    ).toMatchObject({ ok: false, reason: "partial" });
    expect(
      applyTextEdit(set, {
        before: "Read the guide before you apply now",
        after: "Read the guide",
      }),
    ).toMatchObject({ ok: true });
  });

  it("refuses part of a string literal", () => {
    const set = files([
      "src/data/site.ts",
      'export const A = "Apply for a Kernel grant";',
    ]);
    expect(
      applyTextEdit(set, { before: "Kernel grant", after: "R&D grant" }),
    ).toMatchObject({ ok: false, reason: "partial" });
  });

  it("leaves JSX text, YAML and Markdown frontmatter to the agent", () => {
    expect(
      applyTextEdit(
        files(["src/components/X.tsx", "const X = () => <p>Don't wait</p>;"]),
        { before: "Don't wait", after: "Join us" },
      ),
    ).toMatchObject({ ok: false });
    expect(
      applyTextEdit(files(["src/content/x.yml", "title: Kernel round\n"]), {
        before: "Kernel round",
        after: "Q3: Kernel",
      }),
    ).toMatchObject({ ok: false });
    expect(
      applyTextEdit(
        files([
          "src/content/post.md",
          "---\ntitle: Hello there\n---\nHello there\n",
        ]),
        { before: "Hello there", after: "Hi" },
      ),
    ).toMatchObject({ ok: false, reason: "ambiguous" });
  });

  it("edits a whole Markdown line", () => {
    const res = applyTextEdit(
      files(["src/content/post.md", "# Our focus\n\nSome text.\n"]),
      { before: "Our focus", after: "What we fund" },
    );
    expect(res).toMatchObject({ ok: true });
    expect(res.content).toBe("# What we fund\n\nSome text.\n");
  });

  it("skips every protected source path", () => {
    const protectedSrc = [...PROTECTED_DIRS, ...PROTECTED_FILES].filter((p) =>
      p.startsWith("src/"),
    );
    for (const p of protectedSrc) expect(SKIP).toContain(p);
  });
});

describe("inComment", () => {
  it("knows line, block and HTML comments", () => {
    const src = 'a = "x"; // x\n/* y */\n<!-- z -->\n"https://a.b/c"';
    expect(inComment(src, src.indexOf("x"))).toBe(false);
    expect(inComment(src, src.lastIndexOf("x"))).toBe(true);
    expect(inComment(src, src.indexOf("y"))).toBe(true);
    expect(inComment(src, src.indexOf("z"))).toBe(true);
    expect(inComment(src, src.indexOf('c"'))).toBe(false);
  });
});

describe("encodeFor", () => {
  it("escapes backslashes and template expressions in backtick strings", () => {
    const src = "const a = `Hello`;";
    expect(
      encodeFor("x.ts", src, src.indexOf("Hello"), "Cost ${price} \\ more"),
    ).toBe("Cost \\${price} \\\\ more");
  });

  it("treats Astro frontmatter as code", () => {
    const src = '---\nconst title = "Old";\n---\n<h1>{title}</h1>';
    expect(encodeFor("p.astro", src, src.indexOf("Old"), 'Say "hi"')).toBe(
      'Say \\"hi\\"',
    );
  });

  it("refuses line breaks anywhere", () => {
    expect(encodeFor("x.md", "Hello", 0, "a\nb")).toBeNull();
  });
});

describe("applyEdits", () => {
  const site = () =>
    files(
      [
        "src/pages/index.astro",
        "<h1>Fund the commons</h1>\n<p>Read <a>the plan</a> today.</p>\n",
      ],
      ["src/data/site.ts", 'export const intro = "Short intro";\n'],
    );

  it("makes several edits across files, each on the result of the last", () => {
    const res = applyEdits(site(), [
      { before: "Fund the commons", after: "Fund open source" },
      { before: "the plan", after: "our roadmap" },
      { before: "Short intro", after: "A longer intro" },
    ]);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const byPath = Object.fromEntries(
      (res.files ?? []).map((f) => [f.path, f.content]),
    );
    expect(byPath["src/pages/index.astro"]).toContain(
      "<h1>Fund open source</h1>",
    );
    expect(byPath["src/pages/index.astro"]).toContain("<a>our roadmap</a>");
    expect(byPath["src/data/site.ts"]).toContain('"A longer intro"');
  });

  it("changes nothing when any edit can't be made", () => {
    const res = applyEdits(site(), [
      { before: "Fund the commons", after: "Fund open source" },
      { before: "Not on the page", after: "x" },
    ]);
    expect(res).toEqual({ ok: false, reason: "not-found", index: 1 });
  });

  it("matches the text runs either side of a link on their own", () => {
    const res = applyEdits(site(), [{ before: "Read", after: "See" }]);
    expect(res.ok).toBe(true);
  });

  it("refuses an empty or oversized list", () => {
    expect(applyEdits(site(), []).ok).toBe(false);
    expect(
      applyEdits(
        site(),
        Array.from({ length: 31 }, () => ({ before: "a b", after: "c" })),
      ).ok,
    ).toBe(false);
  });
});
