/*
 * The editor's layer inside the preview. Injected into every page by
 * .editor/editor.config.mjs in the sandbox (dev server only; never part of
 * the site). It stays inert until the editor page says hello, so the preview
 * URL opened on its own shows a clean site.
 *
 * It talks to the editor through postMessage:
 *   in:  hello, mode, clear, working, snapshot, endWatch, check, navigate, reload, reveal,
 *        blocks (send the page's text), applyBlocks (show new text at once)
 *   out: ready, select, ask, textEdit, drop, changed, editCancelled, blocks
 *
 * Every element Astro renders in dev carries data-astro-source-file and
 * data-astro-source-loc, which is how a click becomes "this line of this file".
 */
(() => {
  if (window.__filpgfEditor) return;
  window.__filpgfEditor = true;

  const NS = "filpgf-editor";
  const SNAP_KEY = "filpgf-editor:snapshot";
  const BRAND = "#1a5fd0";
  const OK = "#12a150";
  let parentOrigin = null;
  let editMode = true;
  let hovered = null;
  let selected = [];
  let working = [];
  let flashes = [];
  let editing = null;
  let dragTarget = null;
  let lastEvent = null;
  let flashTimer = 0;

  // Astro's dev toolbar (its audit app) moves the source annotations off the
  // elements into private memory soon after load. This layer needs them on the
  // elements, and runs first, so keep those two attributes in place.
  const removeAttribute = Element.prototype.removeAttribute;
  Element.prototype.removeAttribute = function (name) {
    if (name === "data-astro-source-file" || name === "data-astro-source-loc")
      return;
    return removeAttribute.call(this, name);
  };

  // Astro's own dev toolbar is noise in a preview for non-developers.
  const quiet = document.createElement("style");
  quiet.textContent = "astro-dev-toolbar{display:none!important}";
  (document.head || document.documentElement).appendChild(quiet);

  // ---- messaging ------------------------------------------------------------

  function post(msg, transfer) {
    if (!parentOrigin) return;
    window.parent.postMessage({ ns: NS, ...msg }, parentOrigin, transfer || []);
  }

  window.addEventListener("message", (e) => {
    const d = e.data;
    if (!d || d.ns !== NS || e.source !== window.parent) return;
    if (d.type === "hello") {
      if (parentOrigin && e.origin !== parentOrigin) return;
      // Only the page actually framing this one may take control of it.
      const ancestors = location.ancestorOrigins;
      if (ancestors && ancestors.length && ancestors[0] !== e.origin) return;
      parentOrigin = e.origin;
      whenReady(() => {
        mount();
        if (typeof d.edit === "boolean") setMode(d.edit);
        post({ type: "ready", path: location.pathname, title: document.title });
        diffAgainstSnapshot();
      });
      return;
    }
    if (e.origin !== parentOrigin) return;
    switch (d.type) {
      case "mode":
        setMode(!!d.edit);
        break;
      case "clear":
        clearSelection();
        break;
      case "working":
        setWorking(d.on ? d.targets || [] : []);
        break;
      case "snapshot":
        saveSnapshot();
        break;
      case "endWatch":
        try {
          sessionStorage.removeItem(SNAP_KEY);
        } catch {}
        break;
      case "check":
        diffAgainstSnapshot();
        break;
      case "navigate":
        if (
          typeof d.path === "string" &&
          /^\/(?![\/\\])[A-Za-z0-9/_.-]*$/.test(d.path) &&
          d.path !== location.pathname
        ) {
          location.assign(d.path);
        }
        break;
      case "reload":
        location.reload();
        break;
      case "reveal":
        reveal(d.y, d.h);
        break;
      case "blocks":
        post({
          type: "blocks",
          reqId: d.reqId,
          path: location.pathname,
          blocks: textBlocks(),
        });
        break;
      case "applyBlocks":
        applyBlocks(Array.isArray(d.edits) ? d.edits : []);
        break;
      case "ping":
        // For support: what the layer thinks is going on.
        post({
          type: "pong",
          state: {
            mounted: !!root,
            editMode,
            hovered: hovered ? describe(hovered) : null,
            selected: selected.length,
            lastEvent,
            annotated: document.querySelectorAll("[data-astro-source-file]")
              .length,
            path: location.pathname,
          },
        });
        break;
    }
  });

  function whenReady(fn) {
    if (document.readyState === "loading")
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    else fn();
  }

  // ---- element facts ----------------------------------------------------------

  const LABELS = {
    H1: "Heading",
    H2: "Heading",
    H3: "Heading",
    H4: "Heading",
    H5: "Heading",
    H6: "Heading",
    P: "Text",
    SPAN: "Text",
    STRONG: "Text",
    EM: "Text",
    SMALL: "Text",
    LABEL: "Text",
    BLOCKQUOTE: "Quote",
    IMG: "Image",
    PICTURE: "Image",
    FIGURE: "Image",
    SVG: "Icon",
    A: "Link",
    BUTTON: "Button",
    UL: "List",
    OL: "List",
    LI: "List item",
    SECTION: "Section",
    ARTICLE: "Card",
    NAV: "Menu",
    HEADER: "Header",
    FOOTER: "Footer",
    TABLE: "Table",
    FORM: "Form",
    INPUT: "Field",
    DIV: "Block",
  };

  function relFile(abs) {
    const i = abs.indexOf("/site/");
    return i >= 0 ? abs.slice(i + 6) : abs.replace(/^.*?\/(src\/)/, "$1");
  }

  function annotated(el) {
    while (el && el.nodeType === 1) {
      if (el.hasAttribute && el.hasAttribute("data-astro-source-file"))
        return el;
      el = el.parentElement;
    }
    return null;
  }

  function describe(el) {
    const tag = el.tagName;
    const img =
      tag === "IMG"
        ? el
        : el.querySelector && el.children.length <= 2
          ? el.querySelector("img")
          : null;
    const text = (
      el.innerText ||
      el.getAttribute("aria-label") ||
      el.getAttribute("alt") ||
      ""
    )
      .replace(/\s+/g, " ")
      .trim();
    return {
      file: relFile(el.getAttribute("data-astro-source-file") || ""),
      loc: el.getAttribute("data-astro-source-loc") || "",
      tag: tag.toLowerCase(),
      label: LABELS[tag] || "Element",
      text: text.slice(0, 160),
      image: img ? img.getAttribute("src") || "" : "",
      alt: img ? img.getAttribute("alt") || "" : "",
    };
  }

  const INLINE = new Set([
    "A",
    "B",
    "STRONG",
    "EM",
    "I",
    "SPAN",
    "BR",
    "SMALL",
    "CODE",
    "U",
    "MARK",
    "SUP",
    "SUB",
    "ABBR",
    "TIME",
  ]);

  function textEditable(el) {
    if (
      !el ||
      ["IMG", "SVG", "INPUT", "TEXTAREA", "SELECT", "HTML", "BODY"].includes(
        el.tagName,
      )
    )
      return false;
    const text = (el.innerText || "").trim();
    if (!text || text.length > 2000) return false;
    for (const child of el.querySelectorAll("*"))
      if (!INLINE.has(child.tagName)) return false;
    return true;
  }

  // ---- the layer (shadow DOM, so site CSS cannot touch it) --------------------

  let root,
    hoverBox,
    hoverTag,
    selLayer,
    workLayer,
    flashLayer,
    bubble,
    dropBox;

  function mount() {
    if (root) return;
    const host = document.createElement("filpgf-editor-layer");
    host.style.cssText =
      "position:fixed;inset:0;pointer-events:none;z-index:2147483646;";
    document.documentElement.appendChild(host);
    root = host.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        :host{all:initial}
        *{box-sizing:border-box;font-family:"Inter Variable",Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
        .box{position:fixed;pointer-events:none;border-radius:6px;transition:all .08s ease-out}
        .hover{outline:2px solid ${BRAND};outline-offset:2px;background:rgba(26,95,208,.04)}
        .tag{position:fixed;pointer-events:none;background:${BRAND};color:#fff;font-size:11px;font-weight:600;padding:2px 7px;border-radius:5px;letter-spacing:.01em;white-space:nowrap}
        .sel{outline:2px solid ${BRAND};outline-offset:2px;background:rgba(26,95,208,.08)}
        .sel .n{position:absolute;top:-11px;left:-11px;width:20px;height:20px;border-radius:50%;background:${BRAND};color:#fff;font-size:11px;font-weight:700;display:grid;place-items:center}
        .work{outline:2px dashed ${BRAND};outline-offset:3px;animation:pulse 1.2s ease-in-out infinite;background:linear-gradient(90deg,rgba(26,95,208,0) 0%,rgba(26,95,208,.12) 50%,rgba(26,95,208,0) 100%);background-size:200% 100%}
        @keyframes pulse{0%{background-position:100% 0;outline-color:rgba(26,95,208,.9)}50%{outline-color:rgba(26,95,208,.35)}100%{background-position:-100% 0;outline-color:rgba(26,95,208,.9)}}
        .flash{outline:3px solid ${OK};outline-offset:3px;background:rgba(18,161,80,.10);animation:fade 2.8s ease-out forwards}
        @keyframes fade{0%{opacity:1}70%{opacity:1}100%{opacity:0}}
        .drop{outline:3px dashed ${OK};outline-offset:3px;background:rgba(18,161,80,.10)}
        .drop span{position:absolute;inset:auto 8px 8px auto;background:${OK};color:#fff;font-size:12px;font-weight:600;padding:4px 8px;border-radius:6px}
        .bubble{position:fixed;pointer-events:auto;width:340px;background:#fff;color:#0b0d10;border:1px solid #e4e7eb;border-radius:14px;box-shadow:0 12px 40px rgba(11,13,16,.18),0 2px 6px rgba(11,13,16,.06);padding:10px;display:none}
        .bubble.open{display:block;animation:pop .14s ease-out}
        @keyframes pop{from{transform:translateY(4px) scale(.98);opacity:0}to{transform:none;opacity:1}}
        .bubble .what{font-size:12px;color:#5c6472;margin:0 2px 8px;display:flex;gap:6px;align-items:center;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
        .bubble .what b{color:${BRAND};font-weight:600}
        .bubble form{display:flex;gap:6px}
        .bubble input{flex:1;border:1px solid #e4e7eb;border-radius:10px;padding:9px 11px;font-size:14px;color:#0b0d10;outline:none;background:#fff}
        .bubble input:focus{border-color:${BRAND};box-shadow:0 0 0 3px rgba(26,95,208,.15)}
        .bubble button{border:0;border-radius:10px;cursor:pointer;font-size:13px;font-weight:600}
        .go{background:${BRAND};color:#fff;padding:0 12px}
        .chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
        .chip{background:#f3f5f8;color:#3d4450;padding:6px 10px;border-radius:999px!important;font-weight:500!important}
        .chip:hover{background:#e8eefb;color:${BRAND}}
        .hint{font-size:11px;color:#5c6472;margin:8px 2px 0}
      </style>
      <div class="box hover" id="hover" hidden></div>
      <div class="tag" id="tag" hidden></div>
      <div id="sel"></div><div id="work"></div><div id="flash"></div>
      <div class="box drop" id="drop" hidden><span>Drop to use this image</span></div>
      <div class="bubble" id="bubble">
        <div class="what" id="what"></div>
        <form id="ask"><input id="q" placeholder="What should change here?" autocomplete="off"/><button class="go">Ask</button></form>
        <div class="chips" id="chips"></div>
        <p class="hint" id="hint"></p>
      </div>`;
    hoverBox = root.getElementById("hover");
    hoverTag = root.getElementById("tag");
    selLayer = root.getElementById("sel");
    workLayer = root.getElementById("work");
    flashLayer = root.getElementById("flash");
    bubble = root.getElementById("bubble");
    dropBox = root.getElementById("drop");
    root.getElementById("ask").addEventListener("submit", (e) => {
      e.preventDefault();
      const q = root.getElementById("q").value.trim();
      if (!q || !selected.length) return;
      post({ type: "ask", text: q, items: selected.map(describe) });
      root.getElementById("q").value = "";
      bubble.classList.remove("open");
    });
    root.getElementById("q").addEventListener("keydown", (e) => {
      if (e.key === "Escape") clearSelection();
      e.stopPropagation();
    });
    bindPage();
    tick();
  }

  // ---- positioning ----------------------------------------------------------------

  function place(box, el, pad = 0) {
    const r = el.getBoundingClientRect();
    box.style.left = r.left - pad + "px";
    box.style.top = r.top - pad + "px";
    box.style.width = r.width + pad * 2 + "px";
    box.style.height = r.height + pad * 2 + "px";
    return r;
  }

  function tick() {
    if (hovered && editMode && !editing) {
      const r = place(hoverBox, hovered);
      hoverBox.hidden = false;
      hoverTag.hidden = false;
      // Only the label: describe() reads innerText, too costly every frame.
      const label = LABELS[hovered.tagName] || "Element";
      if (hoverTag.textContent !== label) hoverTag.textContent = label;
      hoverTag.style.left = Math.max(4, r.left) + "px";
      hoverTag.style.top = Math.max(4, r.top - 24) + "px";
    } else {
      hoverBox.hidden = true;
      hoverTag.hidden = true;
    }
    [...selLayer.children].forEach(
      (box, i) => selected[i] && place(box, selected[i]),
    );
    [...workLayer.children].forEach(
      (box, i) => working[i] && place(box, working[i], 2),
    );
    [...flashLayer.children].forEach((box, i) => {
      const f = flashes[i];
      if (!f) return;
      if (f.el && f.el.isConnected) place(box, f.el, 2);
      else {
        box.style.left = "8px";
        box.style.width = innerWidth - 16 + "px";
        box.style.top = f.y - scrollY + "px";
        box.style.height = f.h + "px";
      }
    });
    if (dragTarget) {
      place(dropBox, dragTarget, 2);
      dropBox.hidden = false;
    } else dropBox.hidden = true;
    if (selected.length && bubble.classList.contains("open")) placeBubble();
    requestAnimationFrame(tick);
  }

  function placeBubble() {
    const r = selected[selected.length - 1].getBoundingClientRect();
    const w = 340;
    const h = bubble.offsetHeight || 140;
    let top = r.bottom + 10;
    if (top + h > innerHeight - 8) top = Math.max(8, r.top - h - 10);
    const left = Math.min(Math.max(8, r.left), innerWidth - w - 8);
    bubble.style.left = left + "px";
    bubble.style.top = top + "px";
  }

  // ---- select and ask -----------------------------------------------------------------

  function setMode(on) {
    editMode = on;
    if (!on) {
      clearSelection();
      hovered = null;
    }
  }

  function renderSelection() {
    selLayer.innerHTML = "";
    selected.forEach((el, i) => {
      const box = document.createElement("div");
      box.className = "box sel";
      if (selected.length > 1)
        box.innerHTML = `<span class="n">${i + 1}</span>`;
      selLayer.appendChild(box);
    });
    if (!selected.length) {
      bubble.classList.remove("open");
      return;
    }
    const last = describe(selected[selected.length - 1]);
    const what = root.getElementById("what");
    what.textContent = "";
    const b = document.createElement("b");
    b.textContent =
      selected.length > 1 ? `${selected.length} elements` : last.label;
    what.appendChild(b);
    if (selected.length === 1 && (last.text || last.alt))
      what.appendChild(
        document.createTextNode(`“${(last.text || last.alt).slice(0, 48)}”`),
      );
    const chips = root.getElementById("chips");
    chips.innerHTML = "";
    const actions = [];
    const el = selected[selected.length - 1];
    if (selected.length === 1 && textEditable(el))
      actions.push(["Edit text", () => startInlineEdit(el)]);
    if (last.image) actions.push(["Replace image", () => pickImage(el)]);
    if (last.text)
      actions.push([
        "Shorter",
        () => ask("Make this shorter. Keep the meaning."),
      ]);
    if (last.text)
      actions.push([
        "Rewrite",
        () =>
          ask(
            "Rewrite this to be clearer and more compelling. Keep it about the same length.",
          ),
      ]);
    actions.push(["Remove", () => ask("Remove this from the page.")]);
    for (const [label, fn] of actions) {
      const btn = document.createElement("button");
      btn.className = "chip";
      btn.type = "button";
      btn.textContent = label;
      btn.addEventListener("click", fn);
      chips.appendChild(btn);
    }
    root.getElementById("hint").textContent = textEditable(el)
      ? "Tip: double-click text to edit it directly. Shift-click to select more."
      : "Tip: shift-click to select more. Drop a photo on an image to replace it.";
    bubble.classList.add("open");
    placeBubble();
    setTimeout(
      () => root.getElementById("q").focus({ preventScroll: true }),
      30,
    );
  }

  function ask(text) {
    if (!selected.length) return;
    post({ type: "ask", text, items: selected.map(describe) });
    bubble.classList.remove("open");
  }

  function clearSelection() {
    selected = [];
    if (root) renderSelection();
    post({ type: "select", items: [] });
  }

  function inLayer(e) {
    return (
      e.composedPath &&
      e.composedPath().some((n) => n && n.tagName === "FILPGF-EDITOR-LAYER")
    );
  }

  function bindPage() {
    document.addEventListener(
      "mousemove",
      (e) => {
        lastEvent = {
          type: "mousemove",
          x: e.clientX,
          y: e.clientY,
          target: e.target && e.target.tagName,
        };
        if (!editMode || editing || inLayer(e)) return;
        hovered = annotated(e.target);
      },
      true,
    );
    document.addEventListener("mouseleave", () => (hovered = null));
    document.addEventListener(
      "click",
      (e) => {
        lastEvent = "click";
        if (!editMode || inLayer(e)) return;
        if (editing && editing.el.contains(e.target)) {
          // Clicking to place the caret must not follow a link around the text.
          e.preventDefault();
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        const el = annotated(e.target);
        if (!el) return;
        if (e.shiftKey) {
          selected = selected.includes(el)
            ? selected.filter((s) => s !== el)
            : [...selected, el];
        } else selected = [el];
        renderSelection();
        post({ type: "select", items: selected.map(describe) });
      },
      true,
    );
    document.addEventListener(
      "dblclick",
      (e) => {
        if (!editMode || inLayer(e)) return;
        const el = annotated(e.target);
        if (el && textEditable(el)) {
          e.preventDefault();
          startInlineEdit(el);
        }
      },
      true,
    );
    // Forms and keyboard activation must not navigate away while editing.
    document.addEventListener(
      "submit",
      (e) => editMode && e.preventDefault(),
      true,
    );
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !editing) clearSelection();
      // The editor's shortcuts work while the preview has focus too.
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "j")) {
        e.preventDefault();
        post({ type: "shortcut", key: e.key });
      }
    });
    document.addEventListener("dragover", onDragOver, true);
    document.addEventListener("dragleave", (e) => {
      if (!e.relatedTarget) dragTarget = null;
    });
    document.addEventListener("drop", onDrop, true);
  }

  // ---- inline text edit ------------------------------------------------------------

  function startInlineEdit(el) {
    if (editing) stopInlineEdit(false);
    bubble.classList.remove("open");
    const before = norm(el.textContent);
    editing = {
      el,
      before,
      html: el.innerHTML,
      item: describe(el),
      nodes: textNodesIn(el).map((n) => ({ n, data: n.data })),
    };
    // Before typing changes the page, so the saved change can be spotted later.
    saveSnapshot();
    el.setAttribute("contenteditable", "plaintext-only");
    if (el.contentEditable !== "plaintext-only")
      el.setAttribute("contenteditable", "true");
    el.style.outline = `2px solid ${BRAND}`;
    el.style.outlineOffset = "4px";
    el.style.borderRadius = "4px";
    el.style.cursor = "text";
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    el.addEventListener("keydown", onEditKey);
    el.addEventListener("blur", onEditBlur);
  }

  function onEditKey(e) {
    e.stopPropagation();
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      stopInlineEdit(true);
    } else if (e.key === "Escape") {
      e.preventDefault();
      stopInlineEdit(false);
    }
  }

  function onEditBlur() {
    if (editing) stopInlineEdit(true);
  }

  function stopInlineEdit(commit) {
    const { el, before, html, item, nodes } = editing;
    editing = null;
    el.removeEventListener("keydown", onEditKey);
    el.removeEventListener("blur", onEditBlur);
    el.removeAttribute("contenteditable");
    el.style.cursor = "";
    const after = norm(el.textContent);
    if (!commit || !after || after === before) {
      el.innerHTML = html;
      el.style.outline = "";
      post({ type: "editCancelled" });
      return;
    }
    // Shown at once; the dev server reloads the page with the saved text.
    el.style.outline = `2px dashed ${OK}`;
    post({
      type: "textEdit",
      item,
      before,
      after,
      edits: nodeEdits(el, nodes),
    });
  }

  const norm = (s) =>
    String(s || "")
      .replace(/\s+/g, " ")
      .trim();

  /** The text nodes under `el` that hold more than spacing. */
  function textNodesIn(el) {
    const out = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode())
      if (norm(n.data)) out.push(n);
    return out;
  }

  /**
   * What changed, as separate runs of text: a sentence with a link in it is
   * several runs in the page and in the source, and each run can be matched
   * on its own. null when the runs themselves changed shape.
   */
  function nodeEdits(el, recorded) {
    const now = textNodesIn(el);
    if (
      now.length === recorded.length &&
      now.every((n, i) => n === recorded[i].n)
    ) {
      const edits = recorded
        .filter((r) => norm(r.n.data) !== norm(r.data))
        .map((r) => ({ before: norm(r.data), after: norm(r.n.data) }));
      return edits.length && edits.every((e) => e.before && e.after)
        ? edits
        : null;
    }
    // Typing over a selection can replace the node; one run stays one run.
    if (recorded.length === 1)
      return [{ before: norm(recorded[0].data), after: norm(el.textContent) }];
    return null;
  }

  // ---- the page's text, for quick wording changes ----------------------------------

  let blockNodes = [];
  const NOT_TEXT =
    "script,style,noscript,template,svg,filpgf-editor-layer,astro-dev-toolbar";

  /**
   * Every visible run of text on the page, in order, with the source file of
   * the element it sits in. The editor sends these to a fast model, which
   * answers with new text for some of them by id.
   */
  function textBlocks() {
    const all = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    );
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = norm(n.data);
      if (!text || text.length > 2000 || !/[\p{L}\p{N}]/u.test(text)) continue;
      const parent = n.parentElement;
      if (!parent || parent.closest(NOT_TEXT)) continue;
      const el = annotated(parent);
      if (!el) continue;
      if (parent.checkVisibility && !parent.checkVisibility()) continue;
      all.push({
        n,
        text,
        tag: parent.tagName.toLowerCase(),
        file: relFile(el.getAttribute("data-astro-source-file") || ""),
        selected: selected.some((s) => s.contains(n)),
      });
    }
    // Long pages: keep what is selected, then the rest in page order.
    let budget = 40_000;
    const keep = new Set();
    for (const b of all)
      if (b.selected) {
        keep.add(b);
        budget -= b.text.length;
      }
    for (const b of all) {
      if (keep.has(b)) continue;
      if (budget - b.text.length < 0 || keep.size >= 900) break;
      keep.add(b);
      budget -= b.text.length;
    }
    blockNodes = [];
    return all
      .filter((b) => keep.has(b))
      .map((b) => {
        blockNodes.push(b.n);
        return {
          id: blockNodes.length - 1,
          text: b.text,
          tag: b.tag,
          file: b.file,
          selected: b.selected,
        };
      });
  }

  /** Shows new text at once; the dev server reloads the page with the saved text shortly after. */
  function applyBlocks(edits) {
    const touched = [];
    for (const e of edits) {
      const n = blockNodes[e && e.id];
      if (!n || !n.isConnected || typeof e.text !== "string") continue;
      const lead = /^\s*/.exec(n.data)[0];
      const trail = /\s*$/.exec(n.data)[0];
      n.data = lead + e.text + trail;
      if (n.parentElement)
        touched.push(annotated(n.parentElement) || n.parentElement);
    }
    const els = [...new Set(touched)].slice(0, 8);
    if (!els.length) return;
    flashes = els.map((el) => ({ el }));
    renderFlashes();
    const r = els[0].getBoundingClientRect();
    if (r.top < 60 || r.bottom > innerHeight - 40)
      scrollTo({
        top: Math.max(0, r.top + scrollY - innerHeight / 3),
        behavior: "smooth",
      });
  }

  // ---- images -----------------------------------------------------------------------

  function dropTargetFor(node) {
    const el = annotated(node);
    if (!el) return null;
    if (el.tagName === "IMG") return el;
    const img = el.querySelector && el.querySelector("img");
    return img && el.querySelectorAll("img").length === 1 ? img : el;
  }

  function onDragOver(e) {
    if (
      !editMode ||
      !e.dataTransfer ||
      ![...e.dataTransfer.types].includes("Files")
    )
      return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    dragTarget = dropTargetFor(document.elementFromPoint(e.clientX, e.clientY));
  }

  async function onDrop(e) {
    if (!editMode || !e.dataTransfer || !e.dataTransfer.files.length) return;
    e.preventDefault();
    e.stopPropagation();
    const target =
      dragTarget ||
      dropTargetFor(document.elementFromPoint(e.clientX, e.clientY));
    dragTarget = null;
    const file = e.dataTransfer.files[0];
    if (!file.type.startsWith("image/")) return;
    await sendImage(file, target);
  }

  function pickImage(el) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp,image/gif";
    input.onchange = () =>
      input.files[0] &&
      sendImage(input.files[0], el.tagName === "IMG" ? el : dropTargetFor(el));
    input.click();
  }

  async function sendImage(file, target) {
    const buffer = await file.arrayBuffer();
    if (target) saveSnapshot();
    post(
      {
        type: "drop",
        item: target ? describe(target) : null,
        name: file.name,
        mime: file.type,
        buffer,
      },
      [buffer],
    );
    clearSelection();
  }

  // ---- watching changes land --------------------------------------------------------

  function setWorking(targets) {
    working = [];
    const all = document.querySelectorAll("[data-astro-source-file]");
    for (const t of targets) {
      for (const el of all) {
        const file = relFile(el.getAttribute("data-astro-source-file"));
        if (file !== t.file) continue;
        if (t.loc && el.getAttribute("data-astro-source-loc") !== t.loc)
          continue;
        // For whole files, mark only the outermost elements of that file.
        if (
          !t.loc &&
          el.parentElement &&
          annotated(el.parentElement) &&
          relFile(
            annotated(el.parentElement).getAttribute("data-astro-source-file"),
          ) === file
        )
          continue;
        working.push(el);
        if (working.length >= 12) break;
      }
    }
    if (!workLayer) return;
    workLayer.innerHTML = "";
    working.forEach(() => {
      const box = document.createElement("div");
      box.className = "box work";
      workLayer.appendChild(box);
    });
  }

  function collect() {
    const out = {};
    const counts = {};
    for (const el of document.querySelectorAll("[data-astro-source-file]")) {
      if (el.closest("filpgf-editor-layer")) continue;
      const base =
        relFile(el.getAttribute("data-astro-source-file")) + "|" + el.tagName;
      counts[base] = (counts[base] || 0) + 1;
      const key = base + "|" + counts[base];
      out[key] =
        el.tagName === "IMG"
          ? el.getAttribute("src") || ""
          : (el.innerText || "").replace(/\s+/g, " ").trim().slice(0, 400);
    }
    return out;
  }

  function saveSnapshot() {
    try {
      sessionStorage.setItem(
        SNAP_KEY,
        JSON.stringify({
          path: location.pathname,
          at: Date.now(),
          data: collect(),
        }),
      );
    } catch {}
  }

  function diffAgainstSnapshot() {
    let snap = null;
    try {
      snap = JSON.parse(sessionStorage.getItem(SNAP_KEY) || "null");
    } catch {}
    if (
      !snap ||
      snap.path !== location.pathname ||
      Date.now() - snap.at > 30 * 60_000
    )
      return;
    const now = collect();
    const keys = Object.keys(now).filter((k) => snap.data[k] !== now[k]);
    if (!keys.length) {
      post({ type: "changed", path: location.pathname, count: 0 });
      return;
    }
    const byKey = new Map();
    const counts = {};
    for (const el of document.querySelectorAll("[data-astro-source-file]")) {
      const base =
        relFile(el.getAttribute("data-astro-source-file")) + "|" + el.tagName;
      counts[base] = (counts[base] || 0) + 1;
      byKey.set(base + "|" + counts[base], el);
    }
    let els = keys.map((k) => byKey.get(k)).filter(Boolean);
    // Keep the innermost: a changed heading also changes its section's text.
    els = els.filter((el) => !els.some((o) => o !== el && el.contains(o)));
    els = els.filter((el) => el.getBoundingClientRect().height > 0).slice(0, 8);
    if (!els.length) return;
    flashes = els.map((el) => ({ el }));
    renderFlashes();
    const first = els[0].getBoundingClientRect();
    const y = first.top + scrollY;
    if (first.top < 60 || first.bottom > innerHeight - 40)
      scrollTo({ top: Math.max(0, y - innerHeight / 3), behavior: "smooth" });
    post({
      type: "changed",
      path: location.pathname,
      count: els.length,
      y: Math.round(y),
      h: Math.round(first.height),
      // The page width it was measured at; screenshots are 1280 px wide.
      w: innerWidth,
    });
  }

  function renderFlashes() {
    if (!flashLayer) return;
    flashLayer.innerHTML = "";
    flashes.forEach(() => {
      const box = document.createElement("div");
      box.className = "box flash";
      flashLayer.appendChild(box);
    });
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => {
      flashes = [];
      flashLayer.innerHTML = "";
    }, 2900);
  }

  function reveal(y, h) {
    if (typeof y !== "number") return;
    scrollTo({ top: Math.max(0, y - innerHeight / 3), behavior: "smooth" });
    flashes = [{ y, h: Math.max(40, Math.min(h || 120, innerHeight)) }];
    renderFlashes();
  }
})();
