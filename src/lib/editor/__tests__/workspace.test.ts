import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Workspace, EditorError, cleanEdits } from "../workspace";
import { SAVE_SCRIPT } from "../sandbox-scripts";
import type { Sandbox } from "../boat";

/*
 * The save and publish paths against a fake Boat and a fake GitHub: which
 * commit a save builds on, what lands in the tree, what is refused, and how a
 * publish ends. No network.
 */

const sha = (c: string) => c.repeat(40);
const LOCAL = sha("1");
const BASE = sha("2");
const DRAFT = sha("3");
const BLOB_A = sha("a");
const BLOB_B = sha("b");
const Z = sha("0");
const TREE = sha("f");

const sandbox: Sandbox = {
  id: "bx_abcdefgh",
  name: "filpgf-editor-session",
  state: "idle",
};
const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");

type Call = { method: string; url: URL; body: any };

function fakeFetch(opts: {
  draftHead: string | null;
  diff: string;
  saveStdout?: string;
  builtTree?: string;
  sandboxState?: string;
  build?: { running: boolean; exitCode: number | null };
  mergeFails?: boolean;
  compareFiles?: { filename: string; status: string }[];
}) {
  const calls: Call[] = [];
  let draftHead = opts.draftHead;
  const fetchImpl = vi.fn(
    async (input: string | URL, init: RequestInit = {}) => {
      const url = new URL(String(input));
      const method = init.method ?? "GET";
      const body = init.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method, url, body });
      const ok = (data: unknown, status = 200) =>
        new Response(JSON.stringify({ ok: true, ...(data as object) }), {
          status,
        });
      const p = url.pathname;

      // ---- Boat
      if (url.host === "boat.dev") {
        if (p.endsWith("/commands") && method === "POST") {
          if (body.command === SAVE_SCRIPT) {
            return ok({
              exitCode: 0,
              stdout: opts.saveStdout ?? `COMMIT ${LOCAL}\nTREE ${TREE}\n`,
              stderr: "",
              timedOut: false,
            });
          }
          return ok({ exitCode: 0, stdout: "ok", stderr: "", timedOut: false });
        }
        if (p.endsWith("/files")) {
          const path = url.searchParams.get("path")!;
          if (path.endsWith("/changes"))
            return ok({ content: b64(opts.diff), size: 1 });
          if (path.endsWith("/built-tree"))
            return ok({
              content: b64(`${opts.builtTree ?? TREE}\n`),
              size: 41,
            });
          if (path.endsWith("/base-sha"))
            return ok({ content: b64(`${BASE}\n`), size: 41 });
          if (path.startsWith("/tmp/editor-blobs/"))
            return ok({
              content: b64(`content of ${path.slice(-40)}`),
              size: 1,
            });
        }
        if (/\/commands\/\d+$/.test(p)) {
          const b = opts.build ?? { running: false, exitCode: 0 };
          return ok({
            ...b,
            status: b.running ? "running" : "exited",
            stdout: "build log",
            stderr: "",
          });
        }
        if (method === "DELETE" && p.endsWith(`/sandboxes/${sandbox.id}`))
          return ok({ operation: {} }, 202);
      }

      // ---- GitHub
      if (url.host === "api.github.com") {
        const repo = "/repos/show-karma/filecoin-grants";
        const q = p.slice(repo.length);
        if (q === "/git/ref/heads/editor/draft") {
          return draftHead
            ? ok({ object: { sha: draftHead } })
            : new Response("{}", { status: 404 });
        }
        if (q.startsWith("/git/commits/") && method === "GET")
          return ok({ tree: { sha: `tree-of-${q.slice(13, 17)}` } });
        if (q === "/git/blobs")
          return ok({ sha: `gh-${body.content.slice(0, 6)}` }, 201);
        if (q === "/git/trees") return ok({ sha: "new-tree" }, 201);
        if (q === "/git/commits") return ok({ sha: sha("c") }, 201);
        if (q === "/git/refs" && method === "POST") {
          draftHead = body.sha;
          return ok({}, 201);
        }
        if (q === "/git/refs/heads/editor/draft" && method === "PATCH") {
          draftHead = body.sha;
          return ok({});
        }
        if (q === "/git/refs/heads/editor/draft" && method === "DELETE") {
          draftHead = null;
          return new Response(null, { status: 204 });
        }
        if (q.startsWith("/compare/"))
          return ok({
            ahead_by: 1,
            behind_by: 0,
            files: opts.compareFiles ?? [
              { filename: "src/data/site.ts", status: "modified" },
            ],
          });
        if (q.startsWith("/pulls?")) return ok([] as unknown as object);
        if (q === "/pulls" && method === "POST")
          return ok({ number: 71, html_url: "https://github.com/pr/71" }, 201);
        if (q === "/pulls/71" && method === "PATCH")
          return ok({ number: 71, html_url: "https://github.com/pr/71" });
        if (q === "/pulls/71/merge") {
          return opts.mergeFails
            ? new Response(
                JSON.stringify({ message: "Pull Request is not mergeable" }),
                { status: 405 },
              )
            : ok({ sha: sha("d"), merged: true });
        }
      }
      return new Response(
        JSON.stringify({ message: `unhandled ${method} ${url}` }),
        { status: 599 },
      );
    },
  );
  return { fetchImpl, calls };
}

/** GitHub list endpoints answer arrays; the fake wraps objects, so unwrap that one. */
type FetchMock = {
  getMockImplementation():
    | ((input: string | URL, init?: RequestInit) => Promise<Response>)
    | undefined;
  mockImplementation(
    fn: (input: string | URL, init?: RequestInit) => Promise<Response>,
  ): unknown;
};

function fixPullsList(fetchImpl: FetchMock) {
  const inner = fetchImpl.getMockImplementation()!;
  fetchImpl.mockImplementation(
    async (input: string | URL, init?: RequestInit) => {
      if (String(input).includes("/pulls?"))
        return new Response("[]", { status: 200 });
      return inner(input, init);
    },
  );
}

const raw = (...records: [string, string][]) =>
  records.map(([h, p]) => `${h}\0${p}\0`).join("");

const config = {
  boatApiKey: "boat_test",
  githubToken: "gh_test",
  githubRepo: "show-karma/filecoin-grants",
  password: "x",
  sessionSecret: "y",
  template: "filpgf-editor",
  environment: "filpgf-editor",
  agentProvider: "claude",
  fastModel: "claude-haiku-5-5",
  publishMode: "merge" as const,
  sanity: { projectId: "86k25j71", dataset: "production" },
  quick: { effort: "low" },
  deep: { effort: "high" },
};

let realFetch: typeof fetch;
beforeEach(() => {
  realFetch = globalThis.fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("Workspace.save", () => {
  it("starts the draft branch from where the sandbox started, with the changed files", async () => {
    const { fetchImpl, calls } = fakeFetch({
      draftHead: null,
      diff: raw(
        [`:100644 100644 ${Z} ${BLOB_A} M`, "src/data/site.ts"],
        [`:000000 100755 ${Z} ${BLOB_B} A`, "public/run.sh"],
        [`:100644 000000 ${BLOB_A} ${Z} D`, "src/pages/old.astro"],
      ),
    });
    globalThis.fetch = fetchImpl as unknown as typeof fetch;

    const res = await new Workspace(config).save(
      sandbox,
      "Ada",
      "Change the title",
    );

    expect(res).toEqual({
      saved: true,
      files: ["src/data/site.ts", "public/run.sh", "src/pages/old.astro"],
      skipped: [],
    });
    const tree = calls.find((c) => c.url.pathname.endsWith("/git/trees"))!.body;
    expect(tree.base_tree).toBe("tree-of-2222");
    expect(tree.tree).toEqual([
      {
        path: "src/data/site.ts",
        mode: "100644",
        type: "blob",
        sha: expect.stringMatching(/^gh-/),
      },
      {
        path: "public/run.sh",
        mode: "100755",
        type: "blob",
        sha: expect.stringMatching(/^gh-/),
      },
      { path: "src/pages/old.astro", mode: "100644", type: "blob", sha: null },
    ]);
    const commit = calls.find(
      (c) => c.url.pathname.endsWith("/git/commits") && c.method === "POST",
    )!.body;
    expect(commit.parents).toEqual([BASE]);
    expect(commit.message).toMatch(
      /^Change the title\n\nRequested in the site editor by Ada\./,
    );
    expect(commit.author.name).toBe("Ada (site editor)");
    expect(
      calls.some(
        (c) =>
          c.url.pathname.endsWith("/git/refs") &&
          c.body.ref === "refs/heads/editor/draft",
      ),
    ).toBe(true);
    // The sandbox records the save only after GitHub has it.
    const mark = calls
      .filter((c) => c.url.pathname.endsWith("/commands"))
      .at(-1)!.body.command;
    expect(mark).toContain(`git tag -f editor-saved ${LOCAL}`);
  });

  it("builds on the existing draft and moves it without force", async () => {
    const { fetchImpl, calls } = fakeFetch({
      draftHead: DRAFT,
      diff: raw([`:100644 100644 ${Z} ${BLOB_A} M`, "src/data/site.ts"]),
    });
    globalThis.fetch = fetchImpl as unknown as typeof fetch;
    await new Workspace(config).save(sandbox, "Ada", "x");
    expect(
      calls.find(
        (c) => c.url.pathname.endsWith("/git/commits") && c.method === "POST",
      )!.body.parents,
    ).toEqual([DRAFT]);
    const patch = calls.find((c) => c.method === "PATCH")!;
    expect(patch.body).toEqual({ sha: sha("c"), force: false });
  });

  it("commits nothing when nothing changed, but still records the save point", async () => {
    const { fetchImpl, calls } = fakeFetch({ draftHead: null, diff: "" });
    globalThis.fetch = fetchImpl as unknown as typeof fetch;
    const res = await new Workspace(config).save(sandbox, "Ada", "x");
    expect(res.saved).toBe(false);
    expect(calls.some((c) => c.url.host === "api.github.com")).toBe(false);
  });

  it("never commits protected paths, and reports them", async () => {
    const { fetchImpl, calls } = fakeFetch({
      draftHead: null,
      diff: raw(
        [`:100644 100644 ${Z} ${BLOB_A} M`, ".github/workflows/deploy.yml"],
        [`:100644 100644 ${Z} ${BLOB_B} M`, "src/data/site.ts"],
      ),
      saveStdout: `COMMIT ${LOCAL}\nTREE ${TREE}\nLEFT  M src/lib/editor/auth.ts\n`,
    });
    globalThis.fetch = fetchImpl as unknown as typeof fetch;
    const res = await new Workspace(config).save(sandbox, "Ada", "x");
    expect(res.files).toEqual(["src/data/site.ts"]);
    expect(res.skipped).toEqual([
      "src/lib/editor/auth.ts",
      ".github/workflows/deploy.yml",
    ]);
    const tree = calls.find((c) => c.url.pathname.endsWith("/git/trees"))!.body
      .tree;
    expect(tree.map((e: { path: string }) => e.path)).toEqual([
      "src/data/site.ts",
    ]);
  });
});

describe("Workspace.ship", () => {
  it("refuses while the check runs or after it failed", async () => {
    let fake = fakeFetch({
      draftHead: DRAFT,
      diff: "",
      build: { running: true, exitCode: null },
    });
    globalThis.fetch = fake.fetchImpl as unknown as typeof fetch;
    await expect(
      new Workspace(config).ship(sandbox, "Ada", 7, ["x"]),
    ).rejects.toThrow(EditorError);

    fake = fakeFetch({
      draftHead: DRAFT,
      diff: "",
      build: { running: false, exitCode: 1 },
    });
    globalThis.fetch = fake.fetchImpl as unknown as typeof fetch;
    await expect(
      new Workspace(config).ship(sandbox, "Ada", 7, ["x"]),
    ).rejects.toThrow(/did not pass/);
    expect(fake.calls.some((c) => c.url.pathname.includes("/merge"))).toBe(
      false,
    );
  });

  it("merges the draft at the checked commit, then cleans up", async () => {
    const { fetchImpl, calls } = fakeFetch({ draftHead: DRAFT, diff: "" });
    fixPullsList(fetchImpl);
    globalThis.fetch = fetchImpl as unknown as typeof fetch;
    const res = await new Workspace(config).ship(sandbox, "Ada", 7, [
      "Change the title",
    ]);
    expect(res).toEqual({
      published: true,
      prUrl: "https://github.com/pr/71",
      commit: sha("d"),
    });
    const merge = calls.find((c) =>
      c.url.pathname.endsWith("/pulls/71/merge"),
    )!.body;
    expect(merge).toMatchObject({
      merge_method: "squash",
      sha: DRAFT,
      commit_title: "Change the title (#71)",
    });
    expect(
      calls.some(
        (c) =>
          c.method === "DELETE" &&
          c.url.pathname.endsWith("/git/refs/heads/editor/draft"),
      ),
    ).toBe(true);
    expect(
      calls.some(
        (c) =>
          c.method === "DELETE" &&
          c.url.pathname.endsWith(`/sandboxes/${sandbox.id}`),
      ),
    ).toBe(true);
  });

  it("keeps the draft and the workspace when GitHub will not merge", async () => {
    const { fetchImpl, calls } = fakeFetch({
      draftHead: DRAFT,
      diff: "",
      mergeFails: true,
    });
    fixPullsList(fetchImpl);
    globalThis.fetch = fetchImpl as unknown as typeof fetch;
    const res = await new Workspace(config).ship(sandbox, "Ada", 7, ["a", "b"]);
    expect(res).toMatchObject({
      published: false,
      prUrl: "https://github.com/pr/71",
    });
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
  });

  it("refuses while the assistant is still working", async () => {
    const { fetchImpl } = fakeFetch({ draftHead: DRAFT, diff: "" });
    globalThis.fetch = fetchImpl as unknown as typeof fetch;
    await expect(
      new Workspace(config).ship({ ...sandbox, state: "running" }, "Ada", 7, [
        "x",
      ]),
    ).rejects.toThrow(/still working/);
  });

  it("refuses when protected changes are pending, since the build included them", async () => {
    const { fetchImpl, calls } = fakeFetch({
      draftHead: DRAFT,
      diff: "",
      saveStdout: `COMMIT ${LOCAL}\nTREE ${TREE}\nLEFT  M package.json\n`,
    });
    globalThis.fetch = fetchImpl as unknown as typeof fetch;
    await expect(
      new Workspace(config).ship(sandbox, "Ada", 7, ["x"]),
    ).rejects.toThrow(/package\.json/);
    expect(calls.some((c) => c.url.pathname.includes("/pulls"))).toBe(false);
  });

  it("refuses when the saved tree is not the one that was built", async () => {
    const { fetchImpl, calls } = fakeFetch({
      draftHead: DRAFT,
      diff: "",
      builtTree: sha("9"),
    });
    globalThis.fetch = fetchImpl as unknown as typeof fetch;
    await expect(
      new Workspace(config).ship(sandbox, "Ada", 7, ["x"]),
    ).rejects.toThrow(/changed after the check/);
    expect(calls.some((c) => c.url.pathname.includes("/pulls"))).toBe(false);
  });

  it("in review mode opens the pull request and does not merge", async () => {
    const { fetchImpl, calls } = fakeFetch({ draftHead: DRAFT, diff: "" });
    fixPullsList(fetchImpl);
    globalThis.fetch = fetchImpl as unknown as typeof fetch;
    const res = await new Workspace({ ...config, publishMode: "review" }).ship(
      sandbox,
      "Ada",
      7,
      ["x"],
    );
    expect(res).toEqual({
      published: false,
      review: true,
      prUrl: "https://github.com/pr/71",
    });
    expect(calls.some((c) => c.url.pathname.includes("/merge"))).toBe(false);
    expect(
      calls.some(
        (c) => c.method === "DELETE" && c.url.pathname.includes("/git/refs"),
      ),
    ).toBe(false);
  });

  it("says so when there is nothing to publish", async () => {
    const { fetchImpl } = fakeFetch({ draftHead: null, diff: "" });
    globalThis.fetch = fetchImpl as unknown as typeof fetch;
    const res = await new Workspace(config).ship(sandbox, "Ada", 7, []);
    expect(res).toEqual({
      published: false,
      reason: "There are no changes to publish.",
    });
  });
});

describe("quick edits", () => {
  function boatAnswering(stdout: string) {
    const commands: string[] = [];
    globalThis.fetch = vi.fn(
      async (input: string | URL, init: RequestInit = {}) => {
        const body = init.body ? JSON.parse(String(init.body)) : {};
        commands.push(body.command);
        return new Response(
          JSON.stringify({
            ok: true,
            exitCode: 0,
            stdout,
            stderr: "",
            timedOut: false,
          }),
        );
      },
    ) as unknown as typeof fetch;
    return commands;
  }
  const blocks = [
    {
      id: 0,
      text: "Fund the commons",
      tag: "h1",
      file: "src/pages/index.astro",
      selected: true,
    },
    { id: 1, text: "Hello", tag: "p", file: "src/pages/index.astro" },
  ];

  it("returns the model's edits, checked against the blocks it was sent", async () => {
    const commands = boatAnswering(
      JSON.stringify({
        ok: true,
        edits: [
          {
            id: 0,
            before: "Fund the commons",
            after: "Fund open source",
            file: "src/pages/index.astro",
          },
        ],
        summary: "Reworded the heading",
        ms: 900,
      }) + "\n",
    );
    const res = await new Workspace(config).quickEdit(sandbox, {
      request: "Say open source",
      page: "/",
      blocks,
    });
    expect(res).toEqual({
      ok: true,
      edits: [
        {
          id: 0,
          before: "Fund the commons",
          after: "Fund open source",
          file: "src/pages/index.astro",
        },
      ],
      summary: "Reworded the heading",
      ms: 900,
    });
    const cmd = commands[0];
    expect(cmd).toMatch(
      /^cd \/home\/user\/site && node \.editor\/quick-edit\.mjs [A-Za-z0-9+/=]+$/,
    );
    const payload = JSON.parse(
      Buffer.from(cmd.split(" ").pop()!, "base64").toString("utf8"),
    );
    expect(payload.model).toBe("claude-haiku-5-5");
    expect(payload.blocks[1]).toEqual({ ...blocks[1], selected: false });
  });

  it("refuses edits for blocks it never sent", async () => {
    boatAnswering(
      JSON.stringify({
        ok: true,
        edits: [{ id: 7, before: "a b", after: "c" }],
        summary: "",
      }),
    );
    const res = await new Workspace(config).quickEdit(sandbox, {
      request: "x",
      page: "/",
      blocks,
    });
    expect(res).toEqual({ ok: false, reason: "bad-answer" });
  });

  it("passes the agent's requests on", async () => {
    boatAnswering(JSON.stringify({ ok: false, reason: "agent" }));
    const res = await new Workspace(config).quickEdit(sandbox, {
      request: "Add a photo",
      page: "/",
      blocks,
    });
    expect(res).toEqual({ ok: false, reason: "agent" });
  });

  it("is off without a fast model, and never runs while the agent works", async () => {
    const commands = boatAnswering("{}");
    expect(
      await new Workspace({ ...config, fastModel: null }).quickEdit(sandbox, {
        request: "x",
        page: "/",
        blocks,
      }),
    ).toEqual({ ok: false, reason: "off" });
    await expect(
      new Workspace(config).quickEdit(
        { ...sandbox, state: "running" },
        { request: "x", page: "/", blocks },
      ),
    ).rejects.toThrow(/still working/);
    expect(commands).toEqual([]);
  });

  it("fits long pages into one command by dropping unselected text from the end", async () => {
    const commands = boatAnswering(
      JSON.stringify({ ok: false, reason: "agent" }),
    );
    const many = Array.from({ length: 900 }, (_, i) => ({
      id: i,
      text: `${"word ".repeat(30)}${i}`,
      tag: "p",
      file: "src/pages/index.astro",
      selected: i === 899,
    }));
    await new Workspace(config).quickEdit(sandbox, {
      request: "x",
      page: "/",
      blocks: many,
    });
    const b64arg = commands[0].split(" ").pop()!;
    expect(b64arg.length).toBeLessThanOrEqual(110_000);
    const sent = JSON.parse(
      Buffer.from(b64arg, "base64").toString("utf8"),
    ).blocks;
    expect(sent.some((b: { id: number }) => b.id === 899)).toBe(true);
    expect(sent[0].id).toBe(0);
  });
});

describe("cleanEdits", () => {
  it("keeps well-formed edits and drops bad file hints", () => {
    expect(
      cleanEdits([{ before: " a ", after: "b", file: "../../etc; rm" }]),
    ).toEqual([{ before: "a", after: "b" }]);
    expect(cleanEdits([{ before: "a", after: "" }])).toBeNull();
    expect(cleanEdits([])).toBeNull();
    expect(cleanEdits("nope")).toBeNull();
  });
});
