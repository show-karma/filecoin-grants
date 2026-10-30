// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

/*
 * The preview layer in a simulated page: it stays silent until the editor
 * says hello, turns a click into "this element of this file", sends typed-over
 * text, and spots what changed after a reload.
 */
const code = readFileSync(
  join(process.cwd(), "src/lib/editor/sandbox/overlay.js"),
  "utf8",
);
const sent: Record<string, any>[] = [];
const tick = () => new Promise((r) => setTimeout(r, 10));

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "innerText", {
    get() {
      return this.textContent;
    },
    set(v: string) {
      this.textContent = v;
    },
    configurable: true,
  });
  // jsdom lays nothing out; give elements a size so "visible" checks pass.
  HTMLElement.prototype.getBoundingClientRect = () =>
    ({
      top: 100,
      bottom: 120,
      left: 0,
      right: 200,
      width: 200,
      height: 20,
      x: 0,
      y: 100,
      toJSON() {},
    }) as DOMRect;
  window.scrollTo = (() => {}) as typeof window.scrollTo;
  document.body.innerHTML = `
    <main data-astro-source-file="/home/user/site/src/pages/rnd.astro" data-astro-source-loc="10:1">
      <h1 data-astro-source-file="/home/user/site/src/components/PageHero.astro" data-astro-source-loc="25:80">Research grants</h1>
      <p data-astro-source-file="/home/user/site/src/pages/rnd.astro" data-astro-source-loc="14:3">Fund the <a href="/x" data-astro-source-file="/home/user/site/src/pages/rnd.astro" data-astro-source-loc="14:12">builders</a>.</p>
    </main>`;
  // The editor is this same window in the simulation; record what the layer sends.
  const real = window.postMessage.bind(window);
  window.postMessage = ((msg: any, target: any, transfer?: any) => {
    if (
      msg &&
      msg.ns === "filpgf-editor" &&
      msg.type !== "hello" &&
      !("edit" in msg && msg.type === "mode")
    )
      sent.push(msg);
    return real(msg, "*", transfer);
  }) as typeof window.postMessage;
  new Function(code)();
});

const hello = async () => {
  window.dispatchEvent(
    new MessageEvent("message", {
      data: { ns: "filpgf-editor", type: "hello", edit: true },
      origin: "https://editor.test",
      source: window,
    }),
  );
  await tick();
};

describe("preview layer", () => {
  it("hides Astro's dev toolbar, and says nothing before hello", () => {
    expect(document.head.innerHTML).toContain(
      "astro-dev-toolbar{display:none!important}",
    );
    document
      .querySelector("h1")!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(sent).toEqual([]);
    expect(document.querySelector("filpgf-editor-layer")).toBeNull();
  });

  it("answers hello with the page it is on", async () => {
    await hello();
    expect(sent.find((m) => m.type === "ready")).toMatchObject({ path: "/" });
  });

  it("turns a click into the element and its source line, without following links", async () => {
    sent.length = 0;
    const link = document.querySelector("a")!;
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    link.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    const select = sent.find((m) => m.type === "select");
    expect(select?.items[0]).toMatchObject({
      file: "src/pages/rnd.astro",
      loc: "14:12",
      tag: "a",
      label: "Link",
      text: "builders",
    });
  });

  it("sends typed-over text as a text edit", async () => {
    sent.length = 0;
    const h1 = document.querySelector("h1")!;
    h1.dispatchEvent(
      new MouseEvent("dblclick", { bubbles: true, cancelable: true }),
    );
    h1.textContent = "Research and development grants";
    h1.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    const edit = sent.find((m) => m.type === "textEdit");
    expect(edit).toMatchObject({
      before: "Research grants",
      after: "Research and development grants",
      item: { file: "src/components/PageHero.astro", loc: "25:80" },
    });
  });

  it("sends each changed run of text on its own when the text has a link", async () => {
    sent.length = 0;
    const p = document.querySelector("p")!;
    p.dispatchEvent(
      new MouseEvent("dblclick", { bubbles: true, cancelable: true }),
    );
    p.querySelector("a")!.firstChild!.textContent = "open source builders";
    p.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    const edit = sent.find((m) => m.type === "textEdit");
    expect(edit).toMatchObject({
      before: "Fund the builders.",
      after: "Fund the open source builders.",
      edits: [{ before: "builders", after: "open source builders" }],
    });
  });

  it("lists the page's text for the fast model, and shows its answer at once", async () => {
    const tell = async (data: Record<string, unknown>) => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { ns: "filpgf-editor", ...data },
          origin: "https://editor.test",
          source: window,
        }),
      );
      await tick();
    };
    sent.length = 0;
    await tell({ type: "blocks", reqId: "r1" });
    const reply = sent.find((m) => m.type === "blocks")!;
    expect(reply.reqId).toBe("r1");
    const heading = reply.blocks.find((b: any) => b.tag === "h1");
    expect(heading).toMatchObject({
      text: "Research and development grants",
      file: "src/components/PageHero.astro",
    });
    expect(reply.blocks.map((b: any) => b.text)).toContain(
      "open source builders",
    );
    await tell({
      type: "applyBlocks",
      edits: [{ id: heading.id, text: "Grants for research" }],
    });
    expect(document.querySelector("h1")!.textContent).toBe(
      "Grants for research",
    );
  });

  it("spots what changed since the snapshot", async () => {
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { ns: "filpgf-editor", type: "snapshot" },
        origin: "https://editor.test",
        source: window,
      }),
    );
    await tick();
    sent.length = 0;
    document.querySelector("p")!.firstChild!.textContent = "Back the ";
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { ns: "filpgf-editor", type: "check" },
        origin: "https://editor.test",
        source: window,
      }),
    );
    await tick();
    expect(sent.find((m) => m.type === "changed")).toMatchObject({
      path: "/",
      count: 1,
    });
  });

  it("ignores messages from anyone but the editor that said hello", async () => {
    sent.length = 0;
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { ns: "filpgf-editor", type: "check" },
        origin: "https://evil.test",
        source: window,
      }),
    );
    await tick();
    expect(sent).toEqual([]);
  });
});
