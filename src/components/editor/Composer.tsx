import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import {
  htmlToMarkdown,
  shrinkImage,
  type Attachment,
  type PickedItem,
} from "./util.ts";

/*
 * Where requests are written: text, plus whatever is attached to it — the
 * elements picked in the preview, reference images, pasted documents — and a
 * microphone for dictation.
 */
export function Composer({
  text,
  setText,
  items,
  onRemoveItem,
  attachments,
  setAttachments,
  running,
  disabled,
  onSend,
  onStop,
  onError,
  inputRef,
}: {
  text: string;
  setText: (t: string) => void;
  items: PickedItem[];
  onRemoveItem: (index: number) => void;
  attachments: Attachment[];
  setAttachments: (fn: (a: Attachment[]) => Attachment[]) => void;
  running: boolean;
  disabled: boolean;
  onSend: () => void;
  onStop: () => void;
  onError: (message: string) => void;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const [dragging, setDragging] = useState(false);
  const [sends, setSends] = useState(0);
  const send = () => {
    setSends((n) => n + 1);
    onSend();
  };
  const fileInput = useRef<HTMLInputElement>(null);

  const addImages = async (files: File[]) => {
    for (const file of files
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, 4)) {
      try {
        const { data, mime } = await shrinkImage(file, 1600);
        if (data.length * 0.75 > 2_800_000) {
          onError(`${file.name} is too large.`);
          continue;
        }
        setAttachments((a) => [
          ...a,
          {
            id: crypto.randomUUID(),
            kind: "image",
            name: file.name || "screenshot.png",
            mime,
            data,
            preview: URL.createObjectURL(file),
          },
        ]);
      } catch {
        onError(`Couldn't read ${file.name || "that image"}.`);
      }
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = [...e.clipboardData.files];
    if (files.some((f) => f.type.startsWith("image/"))) {
      e.preventDefault();
      void addImages(files);
      return;
    }
    // A long pasted document (Google Docs, Word) keeps its headings and lists
    // and goes in as an attachment, so the request itself stays readable.
    const html = e.clipboardData.getData("text/html");
    const plain = e.clipboardData.getData("text/plain");
    if (html && plain.length > 400) {
      e.preventDefault();
      const markdown = htmlToMarkdown(html);
      const title = (markdown.split("\n").find((l) => l.trim()) ?? "Document")
        .replace(/^#+\s*/, "")
        .slice(0, 60);
      setAttachments((a) => [
        ...a,
        {
          id: crypto.randomUUID(),
          kind: "doc",
          title,
          markdown,
          words: markdown.split(/\s+/).filter(Boolean).length,
        },
      ]);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void addImages([...e.dataTransfer.files]);
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

  // Grow with the text, up to a point.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(220, el.scrollHeight)}px`;
  }, [text, inputRef]);

  const canSend =
    !disabled && !running && (text.trim().length > 0 || attachments.length > 0);

  return (
    <div
      className={`ed-composer${dragging ? " ed-dragging" : ""}`}
      onDragOver={(e) => {
        if ([...e.dataTransfer.types].includes("Files")) {
          e.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      {(items.length > 0 || attachments.length > 0) && (
        <div className="ed-chips">
          {items.map((it, i) => (
            <span
              className="ed-chip ed-chip-target"
              key={`${it.file}:${it.loc}:${i}`}
              title={it.text || it.alt}
            >
              <span aria-hidden="true">⌖</span> {it.label}
              {it.text ? (
                <em>
                  “{it.text.slice(0, 28)}
                  {it.text.length > 28 ? "…" : ""}”
                </em>
              ) : null}
              <button
                aria-label={`Remove ${it.label}`}
                onClick={() => onRemoveItem(i)}
              >
                ×
              </button>
            </span>
          ))}
          {attachments.map((a) =>
            a.kind === "image" ? (
              <span className="ed-chip ed-chip-image" key={a.id}>
                <img src={a.preview} alt="" /> {a.name.slice(0, 24)}
                <button
                  aria-label={`Remove ${a.name}`}
                  onClick={() =>
                    setAttachments((all) => all.filter((x) => x.id !== a.id))
                  }
                >
                  ×
                </button>
              </span>
            ) : (
              <span
                className="ed-chip"
                key={a.id}
                title={a.markdown.slice(0, 400)}
              >
                <span aria-hidden="true">¶</span> {a.title.slice(0, 28)} ·{" "}
                {a.words.toLocaleString()} words
                <button
                  aria-label="Remove document"
                  onClick={() =>
                    setAttachments((all) => all.filter((x) => x.id !== a.id))
                  }
                >
                  ×
                </button>
              </span>
            ),
          )}
        </div>
      )}
      <textarea
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKey}
        onPaste={onPaste}
        rows={1}
        disabled={disabled}
        placeholder={
          items.length
            ? "What should change about the selection?"
            : "Describe a change, or click something in the preview"
        }
        aria-label="Describe a change"
      />
      <div className="ed-composer-bar">
        <button
          className="ed-icon-btn"
          title="Attach an image"
          aria-label="Attach an image"
          onClick={() => fileInput.current?.click()}
          disabled={disabled}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M14.5 9.5 9.6 14.4a3.5 3.5 0 0 1-5-5l5.6-5.6a2.3 2.3 0 0 1 3.3 3.3l-5.4 5.4a1.2 1.2 0 0 1-1.7-1.7L11.2 6" />
          </svg>
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          hidden
          onChange={(e) => {
            void addImages([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
        <Dictation
          text={text}
          setText={setText}
          disabled={disabled}
          stopKey={sends}
        />
        <span className="ed-hint">Shift+Enter for a new line</span>
        <span className="ed-spacer" />
        {running ? (
          <button className="ed-btn ed-small" onClick={onStop}>
            Stop
          </button>
        ) : (
          <button
            className="ed-btn ed-primary ed-small"
            onClick={send}
            disabled={!canSend}
            aria-label="Send"
          >
            Send ↵
          </button>
        )}
      </div>
    </div>
  );
}

type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult:
    | ((e: {
        resultIndex: number;
        results: ArrayLike<
          ArrayLike<{ transcript: string }> & { isFinal: boolean }
        >;
      }) => void)
    | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
};

/** Dictation with the browser's own speech recognition, where there is one. */
function Dictation({
  text,
  setText,
  disabled,
  stopKey,
}: {
  text: string;
  setText: (t: string) => void;
  disabled: boolean;
  /** Changes on every send: dictation stops, so sent words can't come back. */
  stopKey: number;
}) {
  const [listening, setListening] = useState(false);
  const rec = useRef<Recognition | null>(null);
  const base = useRef("");
  const active = useRef(false);

  useEffect(() => {
    active.current = false;
    rec.current?.stop();
  }, [stopKey]);

  const Ctor =
    typeof window !== "undefined"
      ? ((window as unknown as Record<string, unknown>).SpeechRecognition ??
        (window as unknown as Record<string, unknown>).webkitSpeechRecognition)
      : undefined;
  if (!Ctor) return null;

  const toggle = () => {
    if (listening) {
      rec.current?.stop();
      return;
    }
    const r = new (Ctor as new () => Recognition)();
    r.continuous = true;
    r.interimResults = true;
    r.lang = navigator.language || "en-US";
    base.current = text ? `${text.trimEnd()} ` : "";
    r.onresult = (e) => {
      if (!active.current) return;
      let finalText = "";
      let interim = "";
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText += res[0].transcript;
        else interim += res[0].transcript;
      }
      setText(base.current + finalText + interim);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    active.current = true;
    r.start();
    setListening(true);
  };

  return (
    <button
      className={`ed-icon-btn${listening ? " ed-listening" : ""}`}
      title={listening ? "Stop dictation" : "Dictate"}
      aria-label={listening ? "Stop dictation" : "Dictate"}
      aria-pressed={listening}
      onClick={toggle}
      disabled={disabled}
    >
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <rect x="7" y="2.5" width="6" height="10" rx="3" />
        <path d="M4.5 9.5a5.5 5.5 0 0 0 11 0M10 15v2.5" />
      </svg>
    </button>
  );
}
