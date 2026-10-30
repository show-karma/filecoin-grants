import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { foldStreaming, type ChatItem } from "../../lib/editor/chat.ts";
import { pageForFile } from "../../lib/editor/cards.ts";
import {
  ApiError,
  api,
  query,
  sleep,
  type BuildStatus,
  type Card,
  type EventsResponse,
  type PromptResult,
  type QuickEditResult,
  type SaveResult,
  type ShipResult,
  type TextEdit,
  type TextEditResult,
  type UploadResult,
} from "./api.ts";
import { ChangeCard } from "./ChangeCard.tsx";
import { CommandPalette, type Command } from "./CommandPalette.tsx";
import { Composer } from "./Composer.tsx";
import { PublishDialog, type Publish } from "./PublishDialog.tsx";
import {
  PAGES,
  buildPrompt,
  editedFiles,
  pageLabel,
  pageMentioned,
  shrinkImage,
  splitPrompt,
  stepFor,
  type Attachment,
  type PickedItem,
} from "./util.ts";

const NS = "filpgf-editor";
type Mode = "quick" | "deep";
type Device = "desktop" | "tablet" | "phone";
const DEVICES: Record<Exclude<Device, "desktop">, { w: number; h: number }> = {
  tablet: { w: 834, h: 1112 },
  phone: { w: 390, h: 844 },
};

type Turn = {
  promptId: string;
  summary: string;
  shotId: string | null;
  page: string;
  mode: Mode;
  targets: { file: string; loc?: string }[];
};
type Note = {
  kind: "note";
  key: string;
  text: string;
  tone: "info" | "good" | "bad";
  at: number;
};
type Toast = { text: string; tone: "info" | "good" | "bad"; id: number };

type Row =
  | { type: "user"; key: string; text: string; extras: string[] }
  | { type: "bot"; key: string; text: string; streaming: boolean }
  | {
      type: "steps";
      key: string;
      promptId: string | null;
      labels: string[];
      live: boolean;
    }
  | { type: "card"; key: string; card: Card }
  | { type: "note"; key: string; text: string; tone: Note["tone"] };

const ms = (t: number) => (t < 1e12 ? t * 1000 : t);

/** Elements from the preview, reduced to the expected shape (or dropped). */
function pickedItems(value: unknown): PickedItem[] {
  if (!Array.isArray(value)) return [];
  const str = (v: unknown, max: number) =>
    typeof v === "string" ? v.slice(0, max) : "";
  return value
    .filter((v): v is Record<string, unknown> => !!v && typeof v === "object")
    .slice(0, 20)
    .map((v) => ({
      file: str(v.file, 300),
      loc: str(v.loc, 20),
      tag: str(v.tag, 20),
      label: str(v.label, 30) || "Element",
      text: str(v.text, 200),
      image: str(v.image, 400),
      alt: str(v.alt, 200),
    }))
    .filter((v) => /^[\w./-]+$/.test(v.file) && /^[\d:]*$/.test(v.loc));
}

export function Studio({
  name,
  sandboxId,
  previewUrl,
  draftAtStart,
  onSignOut,
  onAuthLost,
  onClosed,
}: {
  name: string;
  sandboxId: string;
  previewUrl: string;
  draftAtStart: boolean;
  onSignOut: () => void;
  onAuthLost: () => void;
  onClosed: (message: string) => void;
}) {
  const previewOrigin = useMemo(() => new URL(previewUrl).origin, [previewUrl]);
  const frame = useRef<HTMLIFrameElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [raw, setRaw] = useState<ChatItem[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [turn, setTurn] = useState<Turn | null>(null);
  const [saving, setSaving] = useState(false);
  // The fast model is working out a wording change (a second or two).
  const [thinking, setThinking] = useState(false);
  // Text changes written and saved in the background, one after another.
  const [pending, setPending] = useState(0);
  // Chat lines for quick edits, which never reach the agent's history.
  const [local, setLocal] = useState<ChatItem[]>([]);
  const [text, setText] = useState("");
  const [items, setItems] = useState<PickedItem[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [page, setPage] = useState("/");
  const [editMode, setEditMode] = useState(true);
  const [device, setDevice] = useState<Device>("desktop");
  const [panel, setPanel] = useState(true);
  const [palette, setPalette] = useState(false);
  const [publish, setPublish] = useState<Publish>({ step: "idle" });
  const [toast, setToast] = useState<Toast | null>(null);
  const [hasDraft, setHasDraft] = useState(draftAtStart);
  const [menu, setMenu] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const cursor = useRef<string | null>(null);
  const seen = useRef(new Set<string>());
  const alive = useRef(true);
  const busyRef = useRef(false);
  const pageRef = useRef("/");
  const editModeRef = useRef(true);
  const lastChanged = useRef<{
    path: string;
    y: number;
    h: number;
    at: number;
  } | null>(null);
  const pendingFocus = useRef<{ id: string; at: number } | null>(null);
  const pendingReveal = useRef<Card | null>(null);
  const publishing = useRef(false);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const blockWaiters = useRef(
    new Map<string, (blocks: unknown[] | null) => void>(),
  );
  const listEnd = useRef<HTMLDivElement>(null);

  // From the end of a turn until its card is saved: not "working", not idle.
  const finalizing = useRef(false);
  const busy =
    turn !== null ||
    saving ||
    thinking ||
    publish.step === "checking" ||
    publish.step === "shipping";
  busyRef.current = busy || finalizing.current;

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // ---- small helpers ----------------------------------------------------------

  const say = useCallback((text: string, tone: Toast["tone"] = "info") => {
    const id = Date.now();
    setToast({ text, tone, id });
    setTimeout(
      () => setToast((t) => (t && t.id === id ? null : t)),
      tone === "bad" ? 6000 : 3200,
    );
  }, []);

  const note = useCallback((text: string, tone: Note["tone"] = "info") => {
    setNotes((n) => [
      ...n,
      {
        kind: "note",
        key: `note:${Date.now()}:${n.length}`,
        text,
        tone,
        at: Date.now(),
      },
    ]);
  }, []);

  const fail = useCallback(
    (e: unknown) => {
      if (e instanceof ApiError && e.status === 401) return onAuthLost();
      if (e instanceof ApiError && e.status === 410)
        return onClosed("This editing session ended");
      setError(e instanceof Error ? e.message : "Something went wrong.");
    },
    [onAuthLost, onClosed],
  );

  // ---- the preview bridge ---------------------------------------------------------

  const post = useCallback(
    (msg: Record<string, unknown>) =>
      frame.current?.contentWindow?.postMessage(
        { ns: NS, ...msg },
        previewOrigin,
      ),
    [previewOrigin],
  );

  const handlerRef = useRef<(d: Record<string, any>) => void>(() => {});
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (
        e.origin !== previewOrigin ||
        e.source !== frame.current?.contentWindow
      )
        return;
      const d = e.data;
      if (!d || d.ns !== NS) return;
      handlerRef.current(d);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [previewOrigin]);

  useEffect(() => {
    editModeRef.current = editMode;
    post({ type: "mode", edit: editMode });
  }, [editMode, post]);

  // ---- events from the agent --------------------------------------------------------

  const pull = useCallback(
    async (promptId?: string) => {
      let run: EventsResponse["run"] = null;
      const added: ChatItem[] = [];
      for (let n = 0; n < 50; n++) {
        const res = await api<EventsResponse>(
          `events?${query({ sandboxId, cursor: cursor.current, promptId })}`,
        );
        cursor.current = res.cursor ?? cursor.current;
        const fresh = res.items.filter((i) => !seen.current.has(i.key));
        fresh.forEach((i) => seen.current.add(i.key));
        if (fresh.length) setRaw((r) => [...r, ...fresh]);
        added.push(...fresh);
        run = res.run;
        if (!res.more) break;
      }
      return { run, added };
    },
    [sandboxId],
  );

  const save = useCallback(
    async (body: Record<string, unknown>) => {
      setSaving(true);
      try {
        const res = await api<SaveResult>("save", {
          method: "POST",
          body: { sandboxId, ...body },
        });
        if (res.saved) {
          setHasDraft(true);
          if (res.card) setCards((c) => [...c, res.card!]);
          else
            note(
              `Saved ${res.files.length} file${res.files.length === 1 ? "" : "s"} to your draft.`,
              "good",
            );
        }
        if (res.skipped.length) {
          note(
            `These changes can't be published from the editor: ${res.skipped.slice(0, 5).join(", ")}. Ask me to undo them, or ask a developer.`,
            "bad",
          );
        }
        return res;
      } catch (e) {
        fail(e);
        return null;
      } finally {
        if (alive.current) setSaving(false);
      }
    },
    [sandboxId, fail, note],
  );

  /** Follows one agent turn to the end, then saves it as a change card. */
  const follow = useCallback(
    async (t: Turn) => {
      setTurn(t);
      const labels: string[] = [];
      let finalText = "";
      const take = (added: ChatItem[]) => {
        for (const i of added) {
          if (i.promptId !== t.promptId) continue;
          if (i.kind === "activity") labels.push(i.label);
          if (i.kind === "assistant" && !i.streaming) finalText = i.text;
        }
        const files = editedFiles(labels);
        if (files.length)
          post({
            type: "working",
            on: true,
            targets: [...t.targets, ...files.map((file) => ({ file }))],
          });
      };
      let lost = false;
      try {
        let failures = 0;
        let unknown = 0;
        for (;;) {
          if (!alive.current) return;
          try {
            const { run, added } = await pull(t.promptId);
            take(added);
            failures = 0;
            if (run?.done) break;
            unknown = run ? 0 : unknown + 1;
            if (unknown > 30) break;
          } catch (e) {
            if (e instanceof ApiError && (e.status === 401 || e.status === 410))
              throw e;
            if (++failures >= 8) throw e;
          }
          await sleep(failures ? 2500 : 1000);
        }
        take((await pull()).added);
      } catch (e) {
        lost = true;
        if (e instanceof ApiError && (e.status === 401 || e.status === 410))
          fail(e);
        else
          setError(
            "Lost touch with the assistant. It may still be working: reload in a moment to see where it got to.",
          );
      } finally {
        post({ type: "check" });
        post({ type: "working", on: false });
        // Stay busy until the card is saved, so nothing slips in between.
        finalizing.current = !lost;
        busyRef.current = true;
        if (alive.current) setTurn(null);
      }
      // Never save half a turn: the agent may still be writing.
      if (!alive.current || lost) {
        busyRef.current = false;
        return;
      }

      // Where the change landed: a page the reply names, else a page file it edited.
      const editedPages = editedFiles(labels)
        .map(pageForFile)
        .filter((p): p is string => !!p);
      const target = pageMentioned(finalText) ?? editedPages[0] ?? null;
      const cardPage = target ?? t.page;
      await sleep(600); // let the preview reload and spot the change
      const changed = lastChanged.current;
      const focus =
        changed &&
        changed.path === cardPage &&
        changed.at > Date.now() - 120_000
          ? { y: changed.y, h: changed.h }
          : null;
      try {
        await save({
          summary: t.summary,
          card: true,
          page: cardPage,
          focus,
          shotId: cardPage === t.page ? t.shotId : null,
          promptId: t.promptId,
        });
      } finally {
        finalizing.current = false;
        busyRef.current = false;
      }
      post({ type: "endWatch" });
      if (target && target !== pageRef.current) {
        post({ type: "navigate", path: target });
        say(`Showing ${pageLabel(target)}, where the change is`);
      }
    },
    [pull, fail, post, save, say],
  );

  // ---- text changes without the agent -------------------------------------------------

  /**
   * Writes text edits into the source and saves them as one change. Runs in a
   * queue in the background: the preview already shows the new text, so
   * nobody waits for the save. `onFail` runs when the edit can't be made
   * exactly, to hand it to the agent.
   */
  const queueText = useCallback(
    (job: {
      edits: TextEdit[];
      summary?: string;
      page: string;
      onFail: () => void;
    }) => {
      const startedAt = Date.now();
      setPending((n) => n + 1);
      const run = queue.current.then(async () => {
        try {
          const res = await api<TextEditResult>("text-edit", {
            method: "POST",
            body: {
              sandboxId,
              edits: job.edits,
              summary: job.summary,
              page: job.page,
            },
          });
          if (!res.ok) {
            setTimeout(job.onFail, 0);
            return;
          }
          if (!res.saved) {
            // Written but not saved (a protected file): show the page as it is.
            post({ type: "reload" });
            say("That text can't be changed from the editor.", "bad");
            return;
          }
          setHasDraft(true);
          setTimeout(() => post({ type: "endWatch" }), 4000);
          const card = res.card;
          if (!card) return;
          // The preview may have spotted the change before the save returned.
          const seen =
            lastChanged.current && lastChanged.current.at >= startedAt
              ? lastChanged.current
              : null;
          if (seen) {
            const focus = { y: seen.y, h: seen.h };
            setCards((c) => [...c, { ...card, focus }]);
            void api("changes", {
              method: "POST",
              body: { sandboxId, id: card.id, focus },
            }).catch(() => undefined);
          } else {
            setCards((c) => [...c, card]);
            pendingFocus.current = { id: card.id, at: Date.now() };
          }
        } catch (e) {
          // The page shows text that isn't saved; put it back.
          post({ type: "reload" });
          fail(e);
        }
      });
      queue.current = run.finally(() => {
        if (alive.current) setPending((n) => n - 1);
      });
    },
    [sandboxId, post, say, fail],
  );

  /** The text on the page in the preview, for the fast model. */
  const askBlocks = useCallback(
    () =>
      new Promise<unknown[] | null>((resolve) => {
        const reqId = Math.random().toString(36).slice(2, 12);
        const timer = setTimeout(() => {
          blockWaiters.current.delete(reqId);
          resolve(null);
        }, 1500);
        blockWaiters.current.set(reqId, (blocks) => {
          clearTimeout(timer);
          blockWaiters.current.delete(reqId);
          resolve(blocks);
        });
        post({ type: "blocks", reqId });
      }),
    [post],
  );

  /** Sends a request to the agent, with the selection and attachments as context. */
  const send = useCallback(
    async (override?: {
      text: string;
      items?: PickedItem[];
      mode?: Mode;
      summary?: string;
      keepSnapshot?: boolean;
    }) => {
      if (busyRef.current) {
        say("Wait for the current change to finish.", "bad");
        return;
      }
      const typed = (override?.text ?? text).trim();
      const useItems = override?.items ?? items;
      const imgs = override
        ? []
        : attachments.filter(
            (a): a is Extract<Attachment, { kind: "image" }> =>
              a.kind === "image",
          );
      const docs = override
        ? []
        : attachments.filter(
            (a): a is Extract<Attachment, { kind: "doc" }> => a.kind === "doc",
          );
      if (!typed && !imgs.length && !docs.length) return;
      busyRef.current = true;
      setError(null);
      const sentAttachments = attachments;
      if (!override) {
        setText("");
        setAttachments([]);
      }
      const targets = useItems.map((i) => ({ file: i.file, loc: i.loc }));

      // Wording changes first go to the fast model: a second or two instead
      // of a full agent turn. Anything else, it hands back.
      const quickable =
        !override?.keepSnapshot &&
        !override?.mode &&
        !imgs.length &&
        !docs.length &&
        typed.length <= 1000;
      let snapshotTaken = false;
      if (quickable) {
        setThinking(true);
        post({ type: "snapshot" });
        snapshotTaken = true;
        post({ type: "working", on: true, targets });
        let res: QuickEditResult | null = null;
        const startedAt = Date.now();
        try {
          const blocks = await askBlocks();
          if (blocks?.length)
            res = await api<QuickEditResult>("quick-edit", {
              method: "POST",
              body: {
                sandboxId,
                request: typed,
                page: pageRef.current,
                blocks,
              },
            });
        } catch (e) {
          if (e instanceof ApiError && (e.status === 401 || e.status === 410)) {
            setThinking(false);
            busyRef.current = false;
            fail(e);
            return;
          }
          // Otherwise the agent takes it.
        }
        if (res?.ok) {
          post({
            type: "applyBlocks",
            edits: res.edits.map((e) => ({ id: e.id, text: e.after })),
          });
          post({ type: "working", on: false });
          post({ type: "clear" });
          setItems([]);
          const at = Date.now();
          const secs = ((at - startedAt) / 1000).toFixed(1);
          setLocal((l) => [
            ...l,
            {
              kind: "user",
              key: `quick:${at}:u`,
              promptId: null,
              text: buildPrompt({
                text: typed,
                page: null,
                items: useItems,
                references: [],
                docs: [],
              }),
              at: startedAt,
            },
            {
              kind: "assistant",
              key: `quick:${at}:a`,
              promptId: null,
              text: `Done in ${secs}s.`,
              streaming: false,
              at,
            },
          ]);
          const page = pageRef.current;
          queueText({
            edits: res.edits.map(({ before, after, file }) => ({
              before,
              after,
              file,
            })),
            summary: res.summary || typed,
            page,
            onFail: () => {
              post({ type: "reload" });
              void send({
                text: typed,
                items: useItems,
                mode: "quick",
                keepSnapshot: true,
              });
            },
          });
          setThinking(false);
          busyRef.current = false;
          return;
        }
        setThinking(false);
      }

      setSaving(true);
      try {
        const references: string[] = [];
        for (const img of imgs) {
          const up = await api<UploadResult>("upload", {
            method: "POST",
            body: {
              sandboxId,
              kind: "reference",
              name: img.name,
              mime: img.mime,
              data: img.data,
            },
          });
          references.push(up.path);
        }
        const ask =
          typed ||
          (docs[0]
            ? `Use the pasted document “${docs[0].title}”`
            : "See the attached image");
        const summary = override?.summary ?? ask;
        const prompt = buildPrompt({
          text: ask,
          page: pageRef.current,
          items: useItems,
          references,
          docs,
        });
        if (!override?.keepSnapshot && !snapshotTaken)
          post({ type: "snapshot" });
        post({ type: "working", on: true, targets });
        lastChanged.current = null;
        // Text changes still saving must land first, as their own changes.
        await queue.current;
        const res = await api<PromptResult>("prompt", {
          method: "POST",
          body: {
            sandboxId,
            text: prompt,
            hasSelection: useItems.length > 0,
            page: pageRef.current,
            mode: override?.mode,
          },
        });
        setItems([]);
        post({ type: "clear" });
        setSaving(false);
        await follow({
          promptId: res.promptId,
          summary,
          shotId: res.shotId,
          page: pageRef.current,
          mode: res.mode,
          targets,
        });
      } catch (e) {
        post({ type: "working", on: false });
        if (!override) {
          setText(typed);
          setAttachments(sentAttachments);
        }
        fail(e);
      } finally {
        if (alive.current) setSaving(false);
      }
    },
    [
      text,
      items,
      attachments,
      sandboxId,
      post,
      follow,
      fail,
      say,
      askBlocks,
      queueText,
    ],
  );

  // ---- direct text edits and dropped images -------------------------------------------

  /** Text typed over in the preview: saved in the background, the agent only if needed. */
  const textEdit = useCallback(
    (d: {
      item: PickedItem;
      before: string;
      after: string;
      edits: TextEdit[] | null;
    }) => {
      if (busyRef.current) {
        say("Wait for the current change to finish.", "bad");
        post({ type: "reload" });
        return;
      }
      setItems([]);
      post({ type: "clear" });
      const short = (t: string) => (t.length > 40 ? `${t.slice(0, 39)}…` : t);
      const summary = `Text: “${short(d.before)}” → “${short(d.after)}”`;
      queueText({
        edits: (d.edits ?? [{ before: d.before, after: d.after }]).map((e) => ({
          ...e,
          file: d.item.file,
        })),
        summary,
        page: pageRef.current,
        onFail: () => {
          say("That one needs the assistant. Handing it over…");
          void send({
            text: `Change the text “${d.before}” to “${d.after}”. Change nothing else.`,
            items: [d.item],
            mode: "quick",
            summary,
            // The preview took its "before" when editing started.
            keepSnapshot: true,
          });
        },
      });
    },
    [say, post, queueText, send],
  );

  const dropImage = useCallback(
    async (d: {
      item: PickedItem | null;
      name: string;
      mime: string;
      buffer: ArrayBuffer;
    }) => {
      if (busyRef.current) {
        say("Wait for the current change to finish.", "bad");
        return;
      }
      try {
        say("Uploading the image…");
        const { data, mime } = await shrinkImage(
          new Blob([d.buffer], { type: d.mime }),
        );
        const up = await api<UploadResult>("upload", {
          method: "POST",
          body: { sandboxId, kind: "site", name: d.name, mime, data },
        });
        const replacing = !!d.item && (d.item.tag === "img" || !!d.item.image);
        const ask = replacing
          ? `Replace this image with the photo I just added (use the URL "${up.url}"; the file is at public${up.url}). Keep the layout as it is and write a short, accurate alt text for it.`
          : `Add the photo I just added here (use the URL "${up.url}"; the file is at public${up.url}). Fit it to the design and write a short, accurate alt text.`;
        await send({
          text: ask,
          items: d.item ? [d.item] : [],
          mode: replacing ? "quick" : "deep",
          summary: replacing ? "Replaced an image" : "Added an image",
          keepSnapshot: true,
        });
      } catch (e) {
        fail(e);
      }
    },
    [sandboxId, say, send, fail],
  );

  // ---- cards ---------------------------------------------------------------------------

  const showCard = useCallback(
    (card: Card) => {
      if (!card.page) return;
      if (card.page !== pageRef.current) {
        pendingReveal.current = card;
        post({ type: "navigate", path: card.page });
      } else post({ type: "reveal", y: card.focus?.y, h: card.focus?.h });
    },
    [post],
  );

  const undo = useCallback(
    async (card: Card) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setSaving(true);
      try {
        await queue.current;
        if (card.page && card.page === pageRef.current)
          post({ type: "snapshot" });
        const res = await api<SaveResult>("undo", {
          method: "POST",
          body: { sandboxId, id: card.id },
        });
        setCards((cs) => [
          ...cs.map((c) => (c.id === card.id ? { ...c, undone: true } : c)),
          ...(res.card ? [res.card] : []),
        ]);
        say("Undone", "good");
        setTimeout(() => post({ type: "endWatch" }), 4000);
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) say(e.message, "bad");
        else fail(e);
      } finally {
        setSaving(false);
        busyRef.current = false;
      }
    },
    [sandboxId, post, say, fail],
  );

  // Messages from the preview. Reassigned every render so it sees current state.
  // The preview is another site: everything it sends is checked before use.
  handlerRef.current = (d) => {
    switch (d.type) {
      case "ready": {
        const raw = typeof d.path === "string" ? d.path : "/";
        if (!/^\/(?![/\\])[A-Za-z0-9/_.-]{0,200}$/.test(raw)) break;
        const path = raw.replace(/(.)\/+$/, "$1");
        pageRef.current = path;
        setPage(path);
        const reveal = pendingReveal.current;
        if (reveal && reveal.page === path) {
          pendingReveal.current = null;
          setTimeout(
            () =>
              post({ type: "reveal", y: reveal.focus?.y, h: reveal.focus?.h }),
            300,
          );
        }
        break;
      }
      case "select":
        setItems(pickedItems(d.items));
        break;
      case "ask": {
        const text = typeof d.text === "string" ? d.text.slice(0, 4000) : "";
        if (text.trim()) void send({ text, items: pickedItems(d.items) });
        break;
      }
      case "textEdit": {
        const [item] = pickedItems([d.item]);
        if (
          item &&
          typeof d.before === "string" &&
          typeof d.after === "string"
        ) {
          const edits = Array.isArray(d.edits)
            ? d.edits
                .slice(0, 30)
                .filter(
                  (e: unknown): e is TextEdit =>
                    !!e &&
                    typeof (e as TextEdit).before === "string" &&
                    typeof (e as TextEdit).after === "string",
                )
                .map((e: TextEdit) => ({
                  before: e.before.slice(0, 4000),
                  after: e.after.slice(0, 4000),
                }))
            : [];
          textEdit({
            item,
            before: d.before.slice(0, 4000),
            after: d.after.slice(0, 4000),
            edits: edits.length ? edits : null,
          });
        }
        break;
      }
      case "drop":
        if (
          d.buffer instanceof ArrayBuffer &&
          typeof d.mime === "string" &&
          d.buffer.byteLength < 25_000_000
        ) {
          void dropImage({
            item: pickedItems([d.item])[0] ?? null,
            name: typeof d.name === "string" ? d.name.slice(0, 120) : "image",
            mime: d.mime,
            buffer: d.buffer,
          });
        }
        break;
      case "changed":
        if (
          d.count > 0 &&
          typeof d.y === "number" &&
          typeof d.path === "string"
        ) {
          // Measured on a narrow frame, the position doesn't match the 1280 px screenshots.
          if (typeof d.w === "number" && d.w < 900) break;
          lastChanged.current = {
            path: d.path,
            y: d.y,
            h: d.h ?? 80,
            at: Date.now(),
          };
          const pf = pendingFocus.current;
          if (pf && Date.now() - pf.at < 30_000) {
            pendingFocus.current = null;
            const focus = { y: d.y, h: d.h ?? 80 };
            setCards((cs) =>
              cs.map((c) => (c.id === pf.id ? { ...c, focus } : c)),
            );
            void api("changes", {
              method: "POST",
              body: { sandboxId, id: pf.id, focus },
            }).catch(() => undefined);
          }
        }
        break;
      case "blocks": {
        const waiter =
          typeof d.reqId === "string" && blockWaiters.current.get(d.reqId);
        if (waiter)
          waiter(Array.isArray(d.blocks) ? d.blocks.slice(0, 1000) : null);
        break;
      }
      case "shortcut":
        if (d.key === "k") setPalette((p) => !p);
        if (d.key === "j") setPanel((p) => !p);
        break;
    }
  };

  // ---- opening: history, cards, and any turn still running -------------------------------

  useEffect(() => {
    (async () => {
      try {
        const [{ added }, cardRes] = await Promise.all([
          pull(),
          api<{ cards: Card[] }>(`changes?${query({ sandboxId })}`).catch(
            () => ({ cards: [] }),
          ),
        ]);
        setCards(cardRes.cards);
        const lastUser = [...added]
          .reverse()
          .find((i) => i.kind === "user" && i.promptId);
        const ended =
          lastUser &&
          added.some(
            (i) => i.kind === "status" && i.promptId === lastUser.promptId,
          );
        if (
          lastUser &&
          lastUser.kind === "user" &&
          lastUser.promptId &&
          !ended
        ) {
          await follow({
            promptId: lastUser.promptId,
            summary: splitPrompt(lastUser.text).text,
            shotId: null,
            page: pageRef.current,
            mode: "deep",
            targets: [],
          });
        } else if (lastUser && lastUser.kind === "user") {
          await save({
            summary: splitPrompt(lastUser.text).text,
            card: true,
            page: null,
          });
        }
      } catch (e) {
        fail(e);
      }
    })();
    // Once per workspace.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sandboxId]);

  // ---- publishing ------------------------------------------------------------------------

  const requests = useMemo(
    () =>
      raw
        .filter(
          (i): i is Extract<ChatItem, { kind: "user" }> => i.kind === "user",
        )
        .map((i) => splitPrompt(i.text).text),
    [raw],
  );

  const runPublish = async () => {
    if (publishing.current) return;
    publishing.current = true;
    setError(null);
    setPublish({ step: "checking", processId: 0, startedAt: Date.now() });
    try {
      await queue.current;
      const { processId } = await api<{ processId: number }>("publish", {
        method: "POST",
        body: { sandboxId, step: "check" },
      });
      setPublish({ step: "checking", processId, startedAt: Date.now() });
      for (;;) {
        await sleep(2500);
        if (!alive.current) return;
        const st = await api<BuildStatus>(
          `publish?${query({ sandboxId, processId })}`,
        );
        if (st.running) continue;
        if (!st.ok) {
          setPublish({ step: "failed", log: st.log });
          return;
        }
        break;
      }
      setPublish({ step: "shipping" });
      const titles = cards
        .filter((c) => !c.undone && c.kind !== "undo")
        .map((c) => c.title);
      const res = await api<ShipResult>("publish", {
        method: "POST",
        body: {
          sandboxId,
          step: "ship",
          processId,
          requests: titles.length ? titles : requests,
        },
      });
      if (res.published) setPublish({ step: "done", prUrl: res.prUrl });
      else if ("review" in res)
        setPublish({ step: "review", prUrl: res.prUrl });
      else
        setPublish({ step: "blocked", reason: res.reason, prUrl: res.prUrl });
    } catch (e) {
      if (e instanceof ApiError && e.status === 409)
        setPublish({ step: "blocked", reason: e.message });
      else {
        setPublish({ step: "idle" });
        fail(e);
      }
    } finally {
      publishing.current = false;
    }
  };

  const closeKeepDraft = async () => {
    setMenu(false);
    try {
      await queue.current;
      await api("session", {
        method: "DELETE",
        body: {
          sandboxId,
          summary: requests[requests.length - 1] ?? "Site edit",
        },
      });
      onClosed("Closed. Your unpublished changes are saved for next time.");
    } catch (e) {
      fail(e);
    }
  };

  const discard = async () => {
    setMenu(false);
    if (
      !window.confirm(
        "Throw away every unpublished change? This cannot be undone.",
      )
    )
      return;
    try {
      await queue.current;
      await api("discard", { method: "POST", body: { sandboxId } });
      onClosed("Unpublished changes thrown away");
    } catch (e) {
      fail(e);
    }
  };

  // ---- keyboard ---------------------------------------------------------------------------

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPalette((p) => !p);
      } else if ((e.metaKey || e.ctrlKey) && e.key === "j") {
        e.preventDefault();
        setPanel((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ---- device frames ----------------------------------------------------------------------

  const stage = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ w: 1000, h: 700 });
  useLayoutEffect(() => {
    if (!stage.current) return;
    const ro = new ResizeObserver(([entry]) =>
      setStageSize({ w: entry.contentRect.width, h: entry.contentRect.height }),
    );
    ro.observe(stage.current);
    return () => ro.disconnect();
  }, []);
  const frameBox = (() => {
    if (device === "desktop")
      return {
        outer: { width: "100%", height: "100%" },
        inner: { width: "100%", height: "100%" },
      };
    const d = DEVICES[device];
    const bezel = device === "phone" ? 14 : 18;
    const fw = d.w + bezel * 2;
    const fh = d.h + bezel * 2;
    const scale = Math.min(1, (stageSize.w - 32) / fw, (stageSize.h - 32) / fh);
    return {
      outer: { width: fw * scale, height: fh * scale },
      inner: {
        width: fw,
        height: fh,
        transform: `scale(${scale})`,
        transformOrigin: "top left",
      },
    };
  })();

  // ---- the timeline -----------------------------------------------------------------------

  const rows = useMemo<Row[]>(() => {
    type Line =
      ChatItem | Note | { kind: "card"; key: string; card: Card; at: number };
    const lines: Line[] = [
      ...foldStreaming(raw),
      ...local,
      ...notes,
      ...cards.map((card) => ({
        kind: "card" as const,
        key: `card:${card.id}`,
        card,
        at: card.at,
      })),
    ].sort((a, b) => ms(a.at) - ms(b.at));
    const out: Row[] = [];
    for (const line of lines) {
      switch (line.kind) {
        case "user": {
          const { text: t, extras } = splitPrompt(line.text);
          out.push({ type: "user", key: line.key, text: t, extras });
          break;
        }
        case "assistant":
          out.push({
            type: "bot",
            key: line.key,
            text: line.text,
            streaming: line.streaming,
          });
          break;
        case "activity": {
          const prev = out[out.length - 1];
          if (prev && prev.type === "steps" && prev.promptId === line.promptId)
            prev.labels.push(line.label);
          else
            out.push({
              type: "steps",
              key: line.key,
              promptId: line.promptId,
              labels: [line.label],
              live: false,
            });
          break;
        }
        case "status":
          if (line.status !== "finished") {
            out.push({
              type: "note",
              key: line.key,
              text:
                line.status === "interrupted"
                  ? "Stopped."
                  : `That didn't work: ${line.error ?? "the assistant hit an error."}`,
              tone: "bad",
            });
          }
          break;
        case "notice":
          out.push({
            type: "note",
            key: line.key,
            text: line.text,
            tone: "bad",
          });
          break;
        case "note":
          out.push({
            type: "note",
            key: line.key,
            text: line.text,
            tone: line.tone,
          });
          break;
        case "card":
          out.push({ type: "card", key: line.key, card: line.card });
          break;
      }
    }
    if (turn)
      for (const r of out)
        if (r.type === "steps" && r.promptId === turn.promptId) r.live = true;
    return out;
  }, [raw, local, notes, cards, turn]);

  useEffect(() => {
    listEnd.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [rows.length, turn]);

  const liveSteps = turn
    ? rows.find((r) => r.type === "steps" && r.live)
    : undefined;

  // ---- commands ----------------------------------------------------------------------------

  const commands: Command[] = [
    ...PAGES.map((p) => ({
      id: `page:${p.path}`,
      group: "Go to page",
      label: `${p.label}  ${p.path}`,
      run: () => post({ type: "navigate", path: p.path }),
    })),
    {
      id: "mode",
      group: "Preview",
      label: editMode
        ? "Browse the site (links work)"
        : "Edit mode (click to select)",
      hint: "",
      run: () => setEditMode((m) => !m),
    },
    {
      id: "desktop",
      group: "Preview",
      label: "Desktop width",
      run: () => setDevice("desktop"),
    },
    {
      id: "tablet",
      group: "Preview",
      label: "Tablet frame",
      run: () => setDevice("tablet"),
    },
    {
      id: "phone",
      group: "Preview",
      label: "Phone frame",
      run: () => setDevice("phone"),
    },
    {
      id: "reload",
      group: "Preview",
      label: "Reload the preview",
      run: () => post({ type: "reload" }),
    },
    {
      id: "live",
      group: "Preview",
      label: "Open this page on the live site",
      run: () =>
        window.open(`https://www.filpgf.io${page}`, "_blank", "noopener"),
    },
    {
      id: "tab",
      group: "Preview",
      label: "Open the preview in a new tab",
      run: () =>
        window.open(new URL(page, previewUrl).toString(), "_blank", "noopener"),
    },
    {
      id: "panel",
      group: "Assistant",
      label: panel ? "Hide the assistant" : "Show the assistant",
      hint: "⌘J",
      run: () => setPanel((p) => !p),
    },
    ...(cards.some((c) => !c.undone && c.kind !== "undo")
      ? [
          {
            id: "undo-last",
            group: "Changes",
            label: "Undo the last change",
            run: () => {
              const last = [...cards]
                .reverse()
                .find((c) => !c.undone && c.kind !== "undo");
              if (last) void undo(last);
            },
          },
        ]
      : []),
    ...(hasDraft
      ? [
          {
            id: "publish",
            group: "Changes",
            label: "Publish…",
            run: () =>
              busyRef.current
                ? say("Wait for the current change to finish.", "bad")
                : setPublish({ step: "confirm" }),
          },
        ]
      : []),
    {
      id: "close",
      group: "Session",
      label: "Close and keep my draft",
      run: () =>
        busyRef.current
          ? say("Wait for the current change to finish.", "bad")
          : void closeKeepDraft(),
    },
    {
      id: "discard",
      group: "Session",
      label: "Throw away unpublished changes",
      run: () =>
        busyRef.current
          ? say("Wait for the current change to finish.", "bad")
          : void discard(),
    },
    { id: "signout", group: "Session", label: "Sign out", run: onSignOut },
  ];

  const status = turn
    ? liveSteps && liveSteps.type === "steps"
      ? `${stepFor(liveSteps.labels[liveSteps.labels.length - 1])}…`
      : "Reading your request…"
    : thinking
      ? "Changing the text…"
      : saving || pending > 0
        ? "Saving…"
        : hasDraft
          ? `Draft saved · ${cards.filter((c) => !c.undone && c.kind !== "undo").length || "earlier"} change${cards.filter((c) => !c.undone && c.kind !== "undo").length === 1 ? "" : "s"} not live`
          : "No changes yet";

  // ---- render ---------------------------------------------------------------------------------

  return (
    <div className={`ed-studio${panel ? " ed-with-panel" : ""}`}>
      <header className="ed-topbar">
        <div className="ed-brand">
          <span className="ed-logo" aria-hidden="true">
            fil<b>pgf</b>
          </span>
          <span className="ed-badge">Studio</span>
        </div>

        <label className="ed-page-select">
          <span className="ed-sr">Page</span>
          <select
            value={PAGES.some((p) => p.path === page) ? page : "__other"}
            onChange={(e) => post({ type: "navigate", path: e.target.value })}
          >
            {PAGES.map((p) => (
              <option key={p.path} value={p.path}>
                {p.label}
              </option>
            ))}
            {!PAGES.some((p) => p.path === page) && (
              <option value="__other">{pageLabel(page)}</option>
            )}
          </select>
        </label>

        <div className="ed-seg" role="group" aria-label="Preview mode">
          <button
            aria-pressed={editMode}
            onClick={() => setEditMode(true)}
            title="Click things on the page to change them"
          >
            Edit
          </button>
          <button
            aria-pressed={!editMode}
            onClick={() => setEditMode(false)}
            title="Use the site normally; links work"
          >
            Browse
          </button>
        </div>

        <div
          className="ed-seg ed-devices"
          role="group"
          aria-label="Preview size"
        >
          {(["desktop", "tablet", "phone"] as Device[]).map((d) => (
            <button
              key={d}
              aria-pressed={device === d}
              onClick={() => setDevice(d)}
              title={d[0].toUpperCase() + d.slice(1)}
            >
              <DeviceIcon device={d} />
              <span className="ed-sr">{d}</span>
            </button>
          ))}
        </div>

        <span className="ed-spacer" />
        <span
          className={`ed-status${turn || saving || thinking || pending > 0 ? " ed-busy" : ""}`}
          aria-live="polite"
        >
          {status}
        </span>
        <button
          className="ed-kbd-btn"
          onClick={() => setPalette(true)}
          title="Commands"
        >
          <kbd>⌘K</kbd>
        </button>
        <button
          className="ed-btn ed-primary"
          disabled={busy || !hasDraft}
          onClick={() => setPublish({ step: "confirm" })}
        >
          Publish
        </button>
        <div className="ed-menu">
          <button
            className="ed-avatar"
            aria-expanded={menu}
            aria-label={`${name}: menu`}
            onClick={() => setMenu((m) => !m)}
          >
            {name.slice(0, 1).toUpperCase()}
          </button>
          {menu && (
            <div
              className="ed-menu-list"
              role="menu"
              onMouseLeave={() => setMenu(false)}
            >
              <div className="ed-menu-name">{name}</div>
              <button role="menuitem" onClick={closeKeepDraft} disabled={busy}>
                Close and keep my draft
              </button>
              <button role="menuitem" onClick={discard} disabled={busy}>
                Throw away unpublished changes
              </button>
              <button role="menuitem" onClick={onSignOut}>
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="ed-stage" ref={stage}>
        <div className={`ed-device ed-device-${device}`} style={frameBox.outer}>
          <div className="ed-device-inner" style={frameBox.inner}>
            <iframe
              ref={frame}
              src={previewUrl}
              title="Site preview"
              referrerPolicy="no-referrer"
              onLoad={() => post({ type: "hello", edit: editModeRef.current })}
            />
          </div>
        </div>
        {editMode && !turn && (
          <div className="ed-stage-hint" aria-hidden="true">
            Click anything to change it · double-click text to edit · drop a
            photo on an image
          </div>
        )}
      </main>

      {panel ? (
        <aside className="ed-panel" aria-label="Assistant">
          <div className="ed-panel-head">
            <strong>Assistant</strong>
            <button
              className="ed-icon-btn"
              onClick={() => setPanel(false)}
              aria-label="Hide the assistant"
              title="Hide (⌘J)"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="M6 6l8 8M14 6l-8 8" />
              </svg>
            </button>
          </div>
          <div className="ed-timeline">
            {rows.length === 0 && !turn && (
              <Welcome
                name={name}
                onExample={(t) => {
                  setText(t);
                  inputRef.current?.focus();
                }}
              />
            )}
            {rows.map((row) => {
              switch (row.type) {
                case "user":
                  return (
                    <div className="ed-msg ed-user" key={row.key}>
                      {row.text}
                      {row.extras.length > 0 && (
                        <span className="ed-msg-extras">
                          {row.extras.join(" · ")}
                        </span>
                      )}
                    </div>
                  );
                case "bot":
                  return (
                    <div
                      className={`ed-msg ed-bot${row.streaming ? " ed-streaming" : ""}`}
                      key={row.key}
                    >
                      {row.text}
                    </div>
                  );
                case "steps": {
                  const open = expanded.has(row.key);
                  const toggle = () =>
                    setExpanded((s) => {
                      const n = new Set(s);
                      if (n.has(row.key)) n.delete(row.key);
                      else n.add(row.key);
                      return n;
                    });
                  return (
                    <div
                      className={`ed-steps${row.live ? " ed-live" : ""}`}
                      key={row.key}
                    >
                      <button onClick={toggle} aria-expanded={open}>
                        {row.live ? (
                          <span className="ed-dot" aria-hidden="true" />
                        ) : (
                          <span aria-hidden="true">✓</span>
                        )}
                        {row.live
                          ? `${stepFor(row.labels[row.labels.length - 1])}…`
                          : "Done"}
                        <span className="ed-muted">
                          {" "}
                          · {row.labels.length} step
                          {row.labels.length === 1 ? "" : "s"}
                        </span>
                        <span className="ed-chev" aria-hidden="true">
                          {open ? "▴" : "▾"}
                        </span>
                      </button>
                      {open && (
                        <ul>
                          {row.labels.map((l, i) => (
                            <li key={i}>{l}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                }
                case "card":
                  return (
                    <ChangeCard
                      key={row.key}
                      card={row.card}
                      sandboxId={sandboxId}
                      busy={busy}
                      onShow={showCard}
                      onUndo={undo}
                    />
                  );
                case "note":
                  return (
                    <div className={`ed-note ed-${row.tone}`} key={row.key}>
                      {row.text}
                    </div>
                  );
              }
            })}
            {turn && !liveSteps && (
              <div className="ed-steps ed-live">
                <button disabled>
                  <span className="ed-dot" aria-hidden="true" />
                  Reading your request…
                </button>
              </div>
            )}
            <div ref={listEnd} />
          </div>
          {error && (
            <p className="ed-error-bar" role="alert">
              {error}
              <button onClick={() => setError(null)} aria-label="Dismiss">
                ×
              </button>
            </p>
          )}
          <Composer
            text={text}
            setText={setText}
            items={items}
            onRemoveItem={(i) => {
              const next = items.filter((_, j) => j !== i);
              setItems(next);
              if (!next.length) post({ type: "clear" });
            }}
            attachments={attachments}
            setAttachments={setAttachments}
            running={turn !== null}
            disabled={
              publish.step === "checking" || publish.step === "shipping"
            }
            onSend={() => void send()}
            onStop={() =>
              void api("interrupt", {
                method: "POST",
                body: { sandboxId },
              }).catch(fail)
            }
            onError={(m) => say(m, "bad")}
            inputRef={inputRef}
          />
        </aside>
      ) : (
        <button className="ed-panel-pill" onClick={() => setPanel(true)}>
          {turn ? (
            <span className="ed-dot" aria-hidden="true" />
          ) : (
            <span aria-hidden="true">✦</span>
          )}
          {turn ? status : "Ask the assistant"} <kbd>⌘J</kbd>
        </button>
      )}

      {toast && (
        <div className={`ed-toast ed-${toast.tone}`} role="status">
          {toast.text}
        </div>
      )}

      {palette && (
        <CommandPalette
          commands={commands}
          onAsk={(t) => {
            setPanel(true);
            void send({ text: t });
          }}
          onClose={() => setPalette(false)}
        />
      )}

      {publish.step !== "idle" && (
        <PublishDialog
          publish={publish}
          cards={cards}
          draftFromEarlier={draftAtStart}
          onConfirm={runPublish}
          onCancel={() => setPublish({ step: "idle" })}
          onAskFix={(log) => {
            setPublish({ step: "idle" });
            void send({
              text: `The publish check failed. Fix the problem so the site builds, without changing anything else. The end of the check output was:\n\n${log.slice(-2500)}`,
            });
          }}
          onDone={onClosed}
        />
      )}
    </div>
  );
}

function Welcome({
  name,
  onExample,
}: {
  name: string;
  onExample: (text: string) => void;
}) {
  return (
    <div className="ed-welcome">
      <h2>Hi {name.split(" ")[0]} 👋</h2>
      <p>
        Change anything on the site. Nothing goes live until you press Publish.
      </p>
      <ul className="ed-tips">
        <li>
          <b>Click</b> anything in the preview and say what should change.
        </li>
        <li>
          <b>Double-click</b> text to edit it directly.
        </li>
        <li>
          <b>Drop a photo</b> on an image to replace it.
        </li>
        <li>
          <b>Paste</b> a screenshot or a Google Doc here, or use the mic.
        </li>
      </ul>
      <p className="ed-muted">Or try:</p>
      {[
        "Add a short FAQ to the R&D page",
        "Make the home page intro friendlier",
        "Update the Kernel deadline to …",
      ].map((t) => (
        <button key={t} className="ed-example" onClick={() => onExample(t)}>
          {t}
        </button>
      ))}
    </div>
  );
}

function DeviceIcon({ device }: { device: Device }) {
  if (device === "desktop")
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <rect x="2.5" y="3.5" width="15" height="10" rx="1.5" />
        <path d="M7 17h6M10 13.5V17" />
      </svg>
    );
  if (device === "tablet")
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <rect x="4.5" y="2.5" width="11" height="15" rx="1.5" />
        <path d="M9 15h2" />
      </svg>
    );
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <rect x="6.5" y="2.5" width="7" height="15" rx="1.5" />
      <path d="M9.25 15h1.5" />
    </svg>
  );
}
