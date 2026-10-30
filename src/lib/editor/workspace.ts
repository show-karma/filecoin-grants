/*
 * The editing workspace: one Boat sandbox at a time, started from the
 * template, with the site checked out, the preview running and an agent
 * working in it. Drafts are saved to the `editor/draft` branch on GitHub after
 * every turn; Publish merges that branch into main and Vercel deploys it.
 *
 * Nothing is stored on our side. The live sandbox is found by name on Boat,
 * the draft is a branch on GitHub, and what has been saved is a git tag inside
 * the sandbox. So any server instance can serve any request.
 */
import {
  Boat,
  BoatError,
  LIVE_STATES,
  eventCursor,
  type Sandbox,
} from "./boat.ts";
import { GitHub, type TreeEntry } from "./github.ts";
import {
  parseRawDiff,
  describeChanges,
  isSha,
  type FileChange,
} from "./git-changes.ts";
import { toChatItems, type ChatItem } from "./chat.ts";
import {
  BLOB_DIR,
  BUILD_COMMAND,
  BUILT_TREE_FILE,
  DEV_PORT,
  DRAFT_BRANCH,
  SAVE_SCRIPT,
  SESSION_NAME,
  READY_CHECK,
  SETUP_LOG_TAIL,
  setupScript,
  STATE_DIR,
  TOOLS_DIR,
  CARDS_FILE,
  DIFF_FILE,
  isProtected,
  markSavedScript,
  appendCardCommand,
  joinUploadScript,
  shotCommand,
  shotPath,
  textEditCommand,
  quickEditCommand,
  QUICK_EDIT_MAX,
  undoScript,
  redoScript,
  uploadChunkCommand,
} from "./sandbox-scripts.ts";
import {
  cardTitle,
  foldCards,
  isPagePath,
  parseUnifiedDiff,
  type Card,
} from "./cards.ts";
import { chooseMode, type Mode } from "./mode.ts";
import type { EditorConfig } from "./config.ts";
import agentRules from "./agent-rules.md?raw";
import overlayJs from "./sandbox/overlay.js?raw";
import editorConfigMjs from "./sandbox/editor.config.mjs?raw";
import textEditMjs from "./sandbox/text-edit.mjs?raw";
import quickEditMjs from "./sandbox/quick-edit.mjs?raw";
import shotMjs from "./sandbox/shot.mjs?raw";

/** A session sandbox stops by itself after this long without a prompt. */
const IDLE_SECONDS = 60 * 60;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const COMMIT_EMAIL = "noreply@filpgf.io";

export class EditorError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "EditorError";
    this.status = status;
  }
}

export type SessionView = {
  state: "none" | "starting" | "ready" | "error";
  sandboxId?: string;
  previewUrl?: string;
  /** One plain line for the loading screen. */
  detail?: string;
  error?: string;
  /** End of the setup log when setup failed, for whoever debugs it. */
  log?: string;
  draft: { exists: boolean };
};

export type SaveResult = {
  saved: boolean;
  files: string[];
  /** Changes the editor refused to save (protected paths). */
  skipped: string[];
  /** The change card for this save, when it saved something and was asked to. */
  card?: Card;
};

/** What the editor knows about a change when it saves it. */
export type SaveMeta = {
  kind: Card["kind"];
  page?: string | null;
  focus?: { y: number; h: number } | null;
  shotId?: string | null;
  promptId?: string | null;
  undoOf?: string | null;
};

export type TextEdit = { before: string; after: string; file?: string };

export type TextEditRequest = {
  /** Applied in order, all or none. */
  edits: TextEdit[];
  /** The change card's title; made from the edit when there is one. */
  summary?: string;
  page?: string | null;
  focus?: { y: number; h: number } | null;
};

/** One run of text on the page, as the preview reports it (see overlay.js textBlocks). */
export type TextBlock = {
  id: number;
  text: string;
  tag: string;
  file: string;
  selected: boolean;
};

export type QuickEditResult =
  | {
      ok: true;
      edits: (TextEdit & { id: number })[];
      summary: string;
      ms: number;
    }
  | { ok: false; reason: string };

const SOURCE_FILE = /^[\w./-]{1,300}$/;

/** Text edits from a request body, checked; null when they aren't usable. */
export function cleanEdits(value: unknown): TextEdit[] | null {
  if (!Array.isArray(value) || !value.length || value.length > 30) return null;
  const out: TextEdit[] = [];
  for (const v of value) {
    if (!v || typeof v !== "object") return null;
    const { before, after, file } = v as Record<string, unknown>;
    if (typeof before !== "string" || typeof after !== "string") return null;
    const b = before.trim();
    const a = after.trim();
    if (!b || !a || b.length > 4000 || a.length > 4000) return null;
    out.push({
      before: b,
      after: a,
      ...(typeof file === "string" && SOURCE_FILE.test(file) ? { file } : {}),
    });
  }
  return out;
}

/** Text blocks from the preview, checked. */
export function cleanBlocks(value: unknown): TextBlock[] {
  if (!Array.isArray(value)) return [];
  const out: TextBlock[] = [];
  for (const v of value.slice(0, 1000)) {
    if (!v || typeof v !== "object") continue;
    const b = v as Record<string, unknown>;
    if (
      typeof b.id !== "number" ||
      !Number.isInteger(b.id) ||
      b.id < 0 ||
      typeof b.text !== "string" ||
      !b.text.trim() ||
      b.text.length > 2000
    )
      continue;
    out.push({
      id: b.id,
      text: b.text.replace(/\s+/g, " ").trim(),
      tag:
        typeof b.tag === "string" && /^[a-z][a-z0-9-]{0,20}$/.test(b.tag)
          ? b.tag
          : "text",
      file:
        typeof b.file === "string" && SOURCE_FILE.test(b.file) ? b.file : "",
      selected: b.selected === true,
    });
  }
  return out;
}

const newId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 16);
const b64json = (value: unknown) =>
  Buffer.from(JSON.stringify(value), "utf8").toString("base64");

export type ShipResult =
  | { published: true; prUrl: string; commit: string }
  | { published: false; review: true; prUrl: string }
  | { published: false; reason: string; prUrl?: string };

const SANDBOX_ID = /^bx_[23456789abcdefghjkmnpqrstuvwxyz]{8}$/;

function oneLine(text: string, max: number): string {
  const line = text
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

async function inBatches<T, R>(
  items: T[],
  size: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  }
  return out;
}

export class Workspace {
  readonly boat: Boat;
  readonly github: GitHub;
  private readonly config: EditorConfig;

  constructor(config: EditorConfig) {
    this.config = config;
    this.boat = new Boat(config.boatApiKey, config.boatApiBase);
    this.github = new GitHub({
      token: config.githubToken,
      repo: config.githubRepo,
      apiBase: config.githubApiBase,
    });
  }

  // ---- Finding and starting the sandbox -------------------------------------

  async findLive(): Promise<Sandbox | null> {
    const list = await this.boat.listSandboxes({
      namePrefix: SESSION_NAME,
      state: LIVE_STATES.join(","),
    });
    return list[0] ?? null;
  }

  /** The sandbox a request names, checked to be one of ours and alive. */
  async require(sandboxId: unknown): Promise<Sandbox> {
    if (typeof sandboxId !== "string" || !SANDBOX_ID.test(sandboxId)) {
      throw new EditorError(400, "Missing or malformed sandbox id.");
    }
    let sandbox: Sandbox;
    try {
      sandbox = await this.boat.getSandbox(sandboxId);
    } catch (e) {
      if (e instanceof BoatError && e.status === 404) {
        throw new EditorError(
          410,
          "This editing session has ended. Reload to start a new one.",
        );
      }
      throw e;
    }
    if (!sandbox.name?.startsWith(SESSION_NAME))
      throw new EditorError(403, "Not an editor session.");
    if (!LIVE_STATES.includes(sandbox.state)) {
      throw new EditorError(
        410,
        "This editing session has ended. Reload to start a new one.",
      );
    }
    return sandbox;
  }

  async status(): Promise<SessionView> {
    const [sandbox, draftHead] = await Promise.all([
      this.findLive(),
      this.github.branchHead(DRAFT_BRANCH),
    ]);
    const draft = { exists: draftHead !== null };
    if (!sandbox) return { state: "none", draft };
    return this.view(sandbox, draft);
  }

  private async view(
    sandbox: Sandbox,
    draft: { exists: boolean },
  ): Promise<SessionView> {
    const base = { sandboxId: sandbox.id, draft };
    if (sandbox.state === "error") {
      return {
        ...base,
        state: "error",
        error: sandbox.error ?? "The workspace failed to start.",
      };
    }
    if (!["ready", "idle", "running"].includes(sandbox.state)) {
      return { ...base, state: "starting", detail: "Starting a workspace…" };
    }
    if (sandbox.setupStatus === "failed") {
      const tail = await this.boat
        .exec(sandbox.id, SETUP_LOG_TAIL)
        .catch(() => null);
      return {
        ...base,
        state: "error",
        error: "The workspace could not load the site.",
        log: [sandbox.setupError, tail?.stdout].filter(Boolean).join("\n"),
      };
    }
    let ready = sandbox.setupStatus === "done";
    if (
      !ready &&
      sandbox.setupStatus !== "pending" &&
      sandbox.setupStatus !== "running"
    ) {
      // Boat gave no setup status: ask the sandbox directly.
      const check = await this.boat
        .exec(sandbox.id, READY_CHECK)
        .catch(() => null);
      ready = check?.stdout.trim() === "ready";
    }
    if (!ready) {
      return {
        ...base,
        state: "starting",
        detail: draft.exists
          ? "Loading your saved draft and starting the preview…"
          : "Loading the latest site and starting the preview…",
      };
    }
    const hosted = await this.boat.host(sandbox.id, DEV_PORT, { public: true });
    return { ...base, state: "ready", previewUrl: hosted.url };
  }

  /** `startKey` is per page load: retries of one start reuse it, a new start never does. */
  async start(startKey: string, editorOrigin?: string): Promise<SessionView> {
    const live = await this.findLive();
    if (live) {
      const draftHead = await this.github.branchHead(DRAFT_BRANCH);
      return this.view(live, { exists: draftHead !== null });
    }
    void this.cleanUpStopped();
    // Without a template (none built yet, or Boat's trial, which has no saved
    // snapshots) the session installs the site itself: slower, same result.
    const fromTemplate = await this.boat.readySnapshot(this.config.template);
    let created;
    try {
      created = await this.boat.createSandbox(
        {
          ...(fromTemplate ? { from: this.config.template } : {}),
          environment: this.config.environment,
          name: SESSION_NAME,
          labels: { app: "filpgf-editor" },
          ttlSeconds: IDLE_SECONDS,
          // Drafts live on GitHub, so a stopped session has nothing worth
          // keeping. No snapshots: cheaper, and a stop simply erases it.
          snapshots: false,
          // Public (no token) so the preview loads in an iframe; a token URL
          // needs a third-party cookie that browsers block. It shows the
          // draft of a public site, behind an unguessable host name.
          hostedPorts: [
            { port: DEV_PORT, public: true, title: "Site preview" },
          ],
          files: [
            { path: "/home/user/AGENTS.md", content: agentRules },
            { path: "/home/user/CLAUDE.md", content: agentRules },
            // The preview's in-page layer and its helpers; the setup script
            // copies them into site/.editor/, which git never sees.
            { path: `${TOOLS_DIR}/overlay.js`, content: overlayJs },
            {
              path: `${TOOLS_DIR}/editor.config.mjs`,
              content: editorConfigMjs,
            },
            { path: `${TOOLS_DIR}/text-edit.mjs`, content: textEditMjs },
            { path: `${TOOLS_DIR}/quick-edit.mjs`, content: quickEditMjs },
            { path: `${TOOLS_DIR}/shot.mjs`, content: shotMjs },
            // Who may frame the preview: this editor, and the live site's.
            {
              path: `${TOOLS_DIR}/frame-ancestors.txt`,
              content: [
                editorOrigin,
                "https://www.filpgf.io",
                "https://filpgf.io",
              ]
                .filter(
                  (o): o is string =>
                    !!o && /^https?:\/\/[a-z0-9.-]+(:\d+)?$/i.test(o),
                )
                .join(" "),
            },
          ],
          setupScript: fromTemplate
            ? setupScript()
            : setupScript(this.config.sanity),
        },
        `filpgf-editor-${startKey}`,
      );
    } catch (e) {
      if (e instanceof BoatError && e.code === "idempotency_in_progress") {
        return {
          state: "starting",
          detail: "Starting a workspace…",
          draft: { exists: false },
        };
      }
      throw e;
    }
    const draftHead = await this.github.branchHead(DRAFT_BRANCH);
    return this.view(created.sandbox, { exists: draftHead !== null });
  }

  /** Sessions that stopped on their own (idle) still show in Boat's list. */
  private async cleanUpStopped(): Promise<void> {
    try {
      const stopped = await this.boat.listSandboxes({
        namePrefix: SESSION_NAME,
        state: "archived,error",
      });
      await Promise.all(
        stopped.map((s) =>
          this.boat.deleteSandbox(s.id).catch(() => undefined),
        ),
      );
    } catch {
      // Housekeeping only.
    }
  }

  // ---- The agent --------------------------------------------------------------

  /**
   * Sends a request to the agent. `display` is what the person typed; `text`
   * may carry extra context (selected elements, attachments). The mode picks
   * quick or thorough reasoning. With `page`, a "before" screenshot of that
   * page is taken alongside, for the change card.
   */
  async prompt(
    sandbox: Sandbox,
    text: string,
    opts: { mode?: Mode; hasSelection?: boolean; page?: string | null } = {},
  ) {
    const prompt = text.trim();
    if (!prompt)
      throw new EditorError(400, "Type what you would like to change.");
    if (prompt.length > 30_000) {
      throw new EditorError(
        400,
        "That message is too long. Please shorten it.",
      );
    }
    const mode = opts.mode ?? chooseMode(prompt, !!opts.hasSelection);
    const pick = mode === "quick" ? this.config.quick : this.config.deep;
    // Each prompt pushes the idle stop back. Failing to extend is not fatal.
    await this.boat.extend(sandbox.id, IDLE_SECONDS).catch(() => undefined);
    let shotId: string | null = null;
    if (isPagePath(opts.page)) {
      shotId = newId();
      await this.boat
        .execDetached(
          sandbox.id,
          shotCommand(
            b64json({ path: opts.page, out: shotPath(shotId, "before") }),
          ),
        )
        .catch(() => (shotId = null));
    }
    // Neither `new` nor `conversationId`: Boat continues the sandbox's one
    // conversation, so a reopened tab keeps the agent's memory.
    const res = await this.boat.prompt(sandbox.id, {
      provider: this.config.agentProvider,
      prompt,
      ...(pick.model ? { model: pick.model } : {}),
      ...(pick.effort ? { reasoningEffort: pick.effort } : {}),
    });
    return { promptId: res.promptId, mode, shotId };
  }

  async events(
    sandbox: Sandbox,
    cursor: string | undefined,
    promptId: string | undefined,
  ) {
    const page = await this.boat.events(sandbox.id, {
      cursor,
      type: "prompt,response,steer,usage_limit",
    });
    const events = page.events ?? [];
    const items: ChatItem[] = toChatItems(events);
    const last = events[events.length - 1];
    const run =
      promptId && /^[\w-]{1,100}$/.test(promptId)
        ? await this.boat.promptRun(sandbox.id, promptId)
        : null;
    return {
      items,
      cursor: last ? eventCursor(last) : (cursor ?? null),
      more: page.pageInfo?.hasMore ?? false,
      run: run ? { status: run.status, done: run.done } : null,
    };
  }

  async interrupt(sandbox: Sandbox) {
    await this.boat.interrupt(sandbox.id);
  }

  // ---- Saving the draft -------------------------------------------------------

  /**
   * Copies what changed in the sandbox since the last save onto the draft
   * branch on GitHub, as one commit. Safe to call when nothing changed.
   */
  async save(
    sandbox: Sandbox,
    author: string,
    summary: string,
    meta?: SaveMeta,
  ): Promise<SaveResult> {
    const { result, prev, local } = await this.saveWithTree(
      sandbox,
      author,
      summary,
    );
    if (!meta || !result.saved) return result;
    // The save is done (GitHub has it); a card that fails to record must not
    // turn that into an error.
    try {
      const card = await this.recordCard(
        sandbox,
        summary,
        meta,
        result.files,
        prev,
        local,
      );
      return { ...result, card };
    } catch (e) {
      console.error("[editor] could not record change card", e);
      return result;
    }
  }

  /** `save`, plus the tree id of what is now saved, for Publish to check against the build. */
  private async saveWithTree(
    sandbox: Sandbox,
    author: string,
    summary: string,
  ): Promise<{
    result: SaveResult;
    tree: string;
    prev: string;
    local: string;
  }> {
    const out = await this.boat.exec(sandbox.id, SAVE_SCRIPT, {
      timeoutSeconds: 45,
    });
    if (out.exitCode !== 0) {
      throw new EditorError(
        500,
        `Could not collect the changes: ${(out.stderr || out.stdout).slice(-500)}`,
      );
    }
    const local = /^COMMIT ([0-9a-f]{40})$/m.exec(out.stdout)?.[1];
    const localTree = /^TREE ([0-9a-f]{40})$/m.exec(out.stdout)?.[1];
    const prev = /^PREV ([0-9a-f]{40})$/m.exec(out.stdout)?.[1] ?? "";
    if (!local || !localTree)
      throw new EditorError(
        500,
        "Could not collect the changes (no commit id).",
      );
    const skipped = out.stdout
      .split("\n")
      .filter((l) => l.startsWith("LEFT "))
      .map((l) => l.slice(8).trim())
      .filter(Boolean);

    const raw = Buffer.from(
      await this.boat.readFileBase64(sandbox.id, `${STATE_DIR}/changes`),
      "base64",
    ).toString("utf8");
    let all: FileChange[];
    try {
      all = parseRawDiff(raw);
    } catch (e) {
      throw new EditorError(
        422,
        `Can't save: ${e instanceof Error ? e.message : "unreadable changes"}. Ask the assistant to undo that.`,
      );
    }
    // SAVE_SCRIPT already excludes these; this is the second lock.
    const changes = all.filter((c) => !isProtected(c.path));
    skipped.push(...all.filter((c) => isProtected(c.path)).map((c) => c.path));

    if (changes.length === 0) {
      await this.markSaved(sandbox, local);
      return {
        result: { saved: false, files: [], skipped },
        tree: localTree,
        prev,
        local,
      };
    }

    const draftHead = await this.github.branchHead(DRAFT_BRANCH);
    const parent = draftHead ?? (await this.baseSha(sandbox));
    const [baseTree, entries] = await Promise.all([
      this.github.commitTree(parent),
      this.treeEntries(sandbox, changes),
    ]);
    const tree = await this.github.createTree(baseTree, entries);
    const message = [
      oneLine(summary || "Site edit", 72),
      "",
      `Requested in the site editor by ${oneLine(author, 60)}.`,
      `Changed ${describeChanges(changes, 20)}.`,
    ].join("\n");
    const commit = await this.github.createCommit({
      message,
      tree,
      parent,
      author: {
        name: `${oneLine(author, 60)} (site editor)`,
        email: COMMIT_EMAIL,
      },
    });
    await this.github.setBranch(DRAFT_BRANCH, commit, draftHead !== null);
    await this.markSaved(sandbox, local);
    return {
      result: { saved: true, files: changes.map((c) => c.path), skipped },
      tree: localTree,
      prev,
      local,
    };
  }

  // ---- Change cards ---------------------------------------------------------------

  /** Builds and stores the card for a save: the diff, and an "after" screenshot. */
  private async recordCard(
    sandbox: Sandbox,
    summary: string,
    meta: SaveMeta,
    files: string[],
    prev: string,
    local: string,
  ): Promise<Card> {
    const id =
      meta.shotId && /^[a-z0-9]{16}$/.test(meta.shotId) ? meta.shotId : newId();
    const page = isPagePath(meta.page) ? meta.page : null;
    const [diff, shots] = await Promise.all([
      this.boat
        .readFileBase64(sandbox.id, DIFF_FILE)
        .then((b) => Buffer.from(b, "base64").toString("utf8"))
        .catch(() => ""),
      page
        ? this.afterShot(sandbox, id, page)
        : Promise.resolve({ before: false, after: false }),
    ]);
    const card: Card = {
      id,
      kind: meta.kind,
      title: cardTitle(summary),
      page,
      focus: meta.focus ?? null,
      files,
      hunks: parseUnifiedDiff(diff),
      shots,
      prev,
      commit: local,
      promptId: meta.promptId ?? null,
      undoOf: meta.undoOf ?? null,
      undone: false,
      at: Date.now(),
    };
    await this.appendCardLine(sandbox, card);
    return card;
  }

  /** Takes the "after" screenshot and reports which of the pair exist. */
  private async afterShot(sandbox: Sandbox, id: string, page: string) {
    const after = shotPath(id, "after");
    const res = await this.boat
      .exec(
        sandbox.id,
        `${shotCommand(b64json({ path: page, out: after }))} >/dev/null; test -s ${shotPath(id, "before")} && echo B; test -s ${after} && echo A`,
        { timeoutSeconds: 50 },
      )
      .catch(() => null);
    const lines = (res?.stdout ?? "").split("\n").map((l) => l.trim());
    return { before: lines.includes("B"), after: lines.includes("A") };
  }

  private async appendCardLine(sandbox: Sandbox, entry: unknown) {
    const res = await this.boat.exec(
      sandbox.id,
      appendCardCommand(b64json(entry)),
    );
    if (res.exitCode !== 0)
      throw new EditorError(500, "Could not record the change.");
  }

  async cards(sandbox: Sandbox): Promise<Card[]> {
    const raw = await this.boat
      .readFileBase64(sandbox.id, CARDS_FILE)
      .catch(() => "");
    return foldCards(Buffer.from(raw, "base64").toString("utf8"));
  }

  /** Puts the change detection's position on a card, for "Show me". */
  async focusCard(
    sandbox: Sandbox,
    id: string,
    focus: { y: number; h: number },
  ) {
    if (!/^[a-z0-9]{16}$/.test(id))
      throw new EditorError(400, "Unknown change.");
    await this.appendCardLine(sandbox, { id, patch: { focus } });
  }

  /** A screenshot from a card, as a JPEG response. */
  async shotImage(
    sandbox: Sandbox,
    id: string,
    which: "before" | "after",
  ): Promise<Response> {
    if (!/^[a-z0-9]{16}$/.test(id))
      throw new EditorError(400, "Unknown screenshot.");
    const b64 = await this.boat
      .readFileBase64(sandbox.id, shotPath(id, which))
      .catch(() => null);
    if (!b64) throw new EditorError(404, "No screenshot.");
    return new Response(Buffer.from(b64, "base64"), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, max-age=86400",
      },
    });
  }

  /** Direct edits must not interleave with the agent's own writes. */
  private requireIdle(sandbox: Sandbox) {
    if (sandbox.state === "running") {
      throw new EditorError(
        409,
        "The assistant is still working. Try again when it has finished.",
      );
    }
  }

  /** Reverses one change and saves that as a change of its own. */
  async undo(
    sandbox: Sandbox,
    author: string,
    id: string,
  ): Promise<SaveResult> {
    const card = (await this.cards(sandbox)).find((c) => c.id === id);
    if (!card)
      throw new EditorError(404, "That change is no longer in this session.");
    if (card.undone)
      throw new EditorError(409, "That change was already undone.");
    if (!isSha(card.prev) || !isSha(card.commit))
      throw new EditorError(409, "That change can't be undone.");
    this.requireIdle(sandbox);
    const res = await this.boat.exec(
      sandbox.id,
      undoScript(card.prev, card.commit),
      { timeoutSeconds: 30 },
    );
    if (res.exitCode !== 0) {
      throw new EditorError(
        409,
        "A later change touched the same spot, so this one can't be undone on its own. Undo the later one first, or ask the assistant.",
      );
    }
    let result: SaveResult;
    try {
      result = await this.save(sandbox, author, `Undo: ${card.title}`, {
        kind: "undo",
        page: card.page,
        focus: card.focus,
        undoOf: card.id,
      });
    } catch (e) {
      // Put the files back as they were, so a retry starts clean.
      await this.boat.exec(sandbox.id, redoScript()).catch(() => undefined);
      throw e;
    }
    await this.appendCardLine(sandbox, {
      id: card.id,
      patch: { undone: true },
    });
    return result;
  }

  /**
   * Replaces text the person typed over in the preview, directly in the
   * source. Returns null when that can't be done safely; the editor then asks
   * the agent instead.
   */
  async textEdit(
    sandbox: Sandbox,
    author: string,
    req: TextEditRequest,
  ): Promise<SaveResult | null> {
    const edits = cleanEdits(req.edits);
    if (!edits) throw new EditorError(400, "Nothing to change.");
    this.requireIdle(sandbox);
    let command: string;
    try {
      command = textEditCommand(b64json({ edits }));
    } catch {
      return null; // Too long to pass directly: the agent takes it.
    }
    const res = await this.boat.exec(sandbox.id, command, {
      timeoutSeconds: 20,
    });
    let outcome: { ok?: boolean } = {};
    try {
      outcome = JSON.parse(res.stdout.trim().split("\n").pop() || "{}");
    } catch {}
    if (!outcome.ok) return null;
    const short = (t: string) => (t.length > 40 ? `${t.slice(0, 39)}…` : t);
    const summary =
      (typeof req.summary === "string" &&
        req.summary.replace(/\s+/g, " ").trim().slice(0, 120)) ||
      (edits.length === 1
        ? `Text: “${short(edits[0].before)}” → “${short(edits[0].after)}”`
        : `Changed ${edits.length} pieces of text`);
    return this.save(sandbox, author, summary, {
      kind: "text",
      page: req.page ?? null,
      focus: req.focus ?? null,
    });
  }

  /**
   * Asks the fast model whether a request is only a wording change, and if
   * so for the new text (see sandbox/quick-edit.mjs). Writes nothing: the
   * editor shows the result at once and saves it with `textEdit`.
   */
  async quickEdit(
    sandbox: Sandbox,
    input: { request: string; page: string | null; blocks: unknown },
  ): Promise<QuickEditResult> {
    const model = this.config.fastModel;
    if (!model) return { ok: false, reason: "off" };
    const request = input.request.trim().slice(0, 2000);
    if (!request) throw new EditorError(400, "Nothing to change.");
    this.requireIdle(sandbox);
    let blocks = cleanBlocks(input.blocks);
    if (!blocks.length) return { ok: false, reason: "no-text" };
    const page = isPagePath(input.page) ? input.page : "/";
    let payload = b64json({ request, page, model, blocks });
    // Commands are capped in size: drop unselected text from the end, a
    // tenth at a time.
    while (payload.length > QUICK_EDIT_MAX) {
      const rest = blocks.filter((b) => !b.selected);
      if (!rest.length) break;
      const cut = new Set(rest.slice(-Math.ceil(rest.length / 10)));
      blocks = blocks.filter((b) => !cut.has(b));
      payload = b64json({ request, page, model, blocks });
    }
    if (payload.length > QUICK_EDIT_MAX)
      return { ok: false, reason: "too-long" };
    const res = await this.boat.exec(sandbox.id, quickEditCommand(payload), {
      timeoutSeconds: 40,
    });
    let out: Record<string, unknown> = {};
    try {
      out = JSON.parse(res.stdout.trim().split("\n").pop() || "{}");
    } catch {}
    if (out.ok !== true) {
      if (out.reason && out.reason !== "agent")
        console.warn(
          "[editor] quick edit declined:",
          out.reason,
          out.detail ?? "",
        );
      return {
        ok: false,
        reason: typeof out.reason === "string" ? out.reason : "error",
      };
    }
    const ids = new Set(blocks.map((b) => b.id));
    const raw = Array.isArray(out.edits) ? out.edits : [];
    const edits = cleanEdits(raw);
    if (
      !edits ||
      edits.length !== raw.length ||
      !raw.every((e) => ids.has((e as { id?: number }).id as number))
    )
      return { ok: false, reason: "bad-answer" };
    return {
      ok: true,
      edits: edits.map((e, i) => ({ ...e, id: (raw[i] as { id: number }).id })),
      summary:
        typeof out.summary === "string"
          ? out.summary.replace(/\s+/g, " ").trim().slice(0, 80)
          : "",
      ms: typeof out.ms === "number" ? out.ms : 0,
    };
  }

  /**
   * Puts an uploaded image into the sandbox: into the site's public/images
   * (to be used on a page) or into ~/attachments (for the agent to look at).
   * Uses a direct file write when the API key may; otherwise chunks it
   * through commands, which Boat caps at ~128 KB each.
   */
  async upload(
    sandbox: Sandbox,
    input: {
      kind: "site" | "reference";
      name: string;
      mime: string;
      data: string;
    },
  ): Promise<{ path: string; url: string | null }> {
    const ext = (
      {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/gif": "gif",
      } as Record<string, string>
    )[input.mime];
    if (!ext) throw new EditorError(415, "Use a JPEG, PNG, WebP or GIF image.");
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(input.data))
      throw new EditorError(400, "That file didn't upload correctly.");
    if (input.data.length * 0.75 > 4 * 1024 * 1024)
      throw new EditorError(413, "That image is over 4 MB.");
    const slug =
      input.name
        .toLowerCase()
        .replace(/\.[a-z0-9]+$/, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40) || "image";
    const file = `${slug}-${newId().slice(0, 6)}.${ext}`;
    const dest =
      input.kind === "site"
        ? `/home/user/site/public/images/uploads/${file}`
        : `/home/user/attachments/${file}`;
    try {
      await this.boat.writeFileBase64(sandbox.id, dest, input.data);
    } catch (e) {
      if (!(
        e instanceof BoatError &&
        (e.status === 403 || e.code === "api_key_action_forbidden")
      ))
        throw e;
      const id = newId();
      const chunks = input.data.match(/.{1,100000}/g) ?? [];
      if (chunks.length > 99)
        throw new EditorError(413, "That image is too large.");
      await inBatches(
        chunks.map((c, i) => [c, i] as const),
        6,
        ([chunk, i]) =>
          this.boat.exec(sandbox.id, uploadChunkCommand(id, i, chunk)),
      );
      const joined = await this.boat.exec(
        sandbox.id,
        joinUploadScript(id, dest),
      );
      if (joined.exitCode !== 0)
        throw new EditorError(500, "The image didn't upload correctly.");
    }
    return {
      path: dest,
      url: input.kind === "site" ? `/images/uploads/${file}` : null,
    };
  }

  private async treeEntries(
    sandbox: Sandbox,
    changes: FileChange[],
  ): Promise<TreeEntry[]> {
    return inBatches(changes, 4, async (change): Promise<TreeEntry> => {
      if (change.kind === "delete") {
        return { path: change.path, mode: "100644", type: "blob", sha: null };
      }
      let content: string;
      try {
        content = await this.boat.readFileBase64(
          sandbox.id,
          `${BLOB_DIR}/${change.blobSha}`,
        );
      } catch (e) {
        if (e instanceof BoatError && /large|size|5 ?MiB/i.test(e.message)) {
          throw new EditorError(
            413,
            `${change.path} is over 5 MB. Ask for a smaller version of it.`,
          );
        }
        throw e;
      }
      if (content.length * 0.75 > MAX_FILE_BYTES) {
        throw new EditorError(
          413,
          `${change.path} is over 5 MB. Ask for a smaller version of it.`,
        );
      }
      const sha = await this.github.createBlob(content);
      return { path: change.path, mode: change.mode, type: "blob", sha };
    });
  }

  private async baseSha(sandbox: Sandbox): Promise<string> {
    const raw = Buffer.from(
      await this.boat.readFileBase64(sandbox.id, `${STATE_DIR}/base-sha`),
      "base64",
    )
      .toString("utf8")
      .trim();
    if (!isSha(raw))
      throw new EditorError(
        500,
        "The workspace lost track of where it started.",
      );
    return raw;
  }

  private async markSaved(sandbox: Sandbox, localCommit: string) {
    const res = await this.boat.exec(sandbox.id, markSavedScript(localCommit));
    if (res.exitCode !== 0)
      throw new EditorError(
        500,
        "Saved to GitHub, but the workspace did not record it.",
      );
  }

  // ---- Publishing ---------------------------------------------------------------

  /** Starts the production build in the sandbox; the UI polls `buildStatus`. */
  async startBuild(sandbox: Sandbox) {
    await this.boat.extend(sandbox.id, IDLE_SECONDS).catch(() => undefined);
    const started = await this.boat.execDetached(sandbox.id, BUILD_COMMAND);
    return { processId: started.processId };
  }

  async buildStatus(sandbox: Sandbox, processId: number) {
    const st = await this.boat.commandStatus(sandbox.id, processId, 6000);
    const output = `${st.stdout}\n${st.stderr}`.trim();
    return {
      running: st.running,
      ok: !st.running && st.exitCode === 0,
      exitCode: st.exitCode,
      // The end of the build log, for the "what went wrong" panel.
      log: output.slice(-4000),
    };
  }

  /**
   * After a passing build: saves the last changes, checks they are exactly
   * what was built, opens (or reuses) a pull request from the draft branch and
   * squash-merges it (or, in review mode, leaves it for a developer), then
   * closes the session. Vercel deploys main as usual.
   */
  async ship(
    sandbox: Sandbox,
    author: string,
    processId: number,
    requests: string[],
  ): Promise<ShipResult> {
    if (sandbox.state === "running") {
      throw new EditorError(
        409,
        "The assistant is still working. Publish when it has finished.",
      );
    }
    const build = await this.buildStatus(sandbox, processId);
    if (build.running)
      throw new EditorError(409, "The check is still running.");
    if (!build.ok)
      throw new EditorError(
        409,
        "The site did not pass its check, so nothing was published.",
      );

    const last = requests[requests.length - 1] ?? "Site edit";
    const { result: saved, tree } = await this.saveWithTree(
      sandbox,
      author,
      last,
    );
    if (saved.skipped.length) {
      throw new EditorError(
        409,
        `Some changes touch files that can't be published from the editor (${saved.skipped.slice(0, 5).join(", ")}). ` +
          "Ask the assistant to undo them, or ask a developer.",
      );
    }
    const builtTree = Buffer.from(
      await this.boat.readFileBase64(sandbox.id, BUILT_TREE_FILE),
      "base64",
    )
      .toString("utf8")
      .trim();
    if (builtTree !== tree) {
      throw new EditorError(
        409,
        "The site changed after the check started. Press Publish again to check the latest version.",
      );
    }

    const head = await this.github.branchHead(DRAFT_BRANCH);
    if (!head)
      return { published: false, reason: "There are no changes to publish." };
    const diff = await this.github.compare("main", head);
    const files = diff.files ?? [];
    if (files.length === 0) {
      await this.github.deleteBranch(DRAFT_BRANCH).catch(() => undefined);
      return { published: false, reason: "There are no changes to publish." };
    }

    const who = oneLine(author, 60);
    const title = oneLine(
      requests.length === 1 ? last : `Site edits by ${who}`,
      72,
    );
    const body = [
      `${this.config.publishMode === "review" ? "Sent for review" : "Published"} from the site editor (/edit) by ${who}.`,
      "",
      "What was asked for:",
      ...(requests.length
        ? requests.slice(-30).map((r) => `- ${oneLine(r, 300)}`)
        : ["- (not recorded)"]),
      "",
      "Files changed:",
      ...files.slice(0, 60).map((f) => `- \`${f.filename}\` (${f.status})`),
      "",
      "The editor ran `pnpm run build` (astro check + astro build) on this exact draft.",
    ].join("\n");

    const pr =
      (await this.github.findOpenPull(DRAFT_BRANCH, "main")) ??
      (await this.github.createPull({
        head: DRAFT_BRANCH,
        base: "main",
        title,
        body,
      }));
    await this.github
      .updatePull(pr.number, { title, body })
      .catch(() => undefined);

    if (this.config.publishMode === "review") {
      await this.boat.deleteSandbox(sandbox.id).catch(() => undefined);
      return { published: false, review: true, prUrl: pr.html_url };
    }

    let merged;
    try {
      merged = await this.github.mergePull(pr.number, {
        sha: head,
        title: `${title} (#${pr.number})`,
        message: body,
      });
    } catch {
      return {
        published: false,
        prUrl: pr.html_url,
        reason:
          "GitHub would not merge the changes automatically (main has moved in a way that conflicts). " +
          "They are saved in the linked pull request; a developer can finish it.",
      };
    }
    // Merged: the rest is housekeeping and must not turn success into an error.
    await this.github.deleteBranch(DRAFT_BRANCH).catch(() => undefined);
    await this.boat.deleteSandbox(sandbox.id).catch(() => undefined);
    return { published: true, prUrl: pr.html_url, commit: merged.sha };
  }

  /** Throws the draft away: deletes the branch and the session. */
  async discard(sandbox: Sandbox | null) {
    await this.github.deleteBranch(DRAFT_BRANCH);
    if (sandbox)
      await this.boat.deleteSandbox(sandbox.id).catch(() => undefined);
  }

  /**
   * Closes the session and keeps the draft for next time. `save: false` is
   * for a workspace that is stuck: the draft on GitHub is kept as it is.
   */
  async close(
    sandbox: Sandbox,
    author: string,
    summary: string,
    save = true,
  ): Promise<SaveResult | null> {
    const result = save ? await this.save(sandbox, author, summary) : null;
    await this.boat.deleteSandbox(sandbox.id);
    return result;
  }
}
