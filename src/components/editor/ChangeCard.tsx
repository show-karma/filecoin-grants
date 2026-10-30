import { useEffect, useRef, useState } from "react";
import type { Card } from "./api.ts";
import { humanize, pageLabel, timeAgo, wordDiff } from "./util.ts";

/*
 * One saved change: what it was, where, before/after, and the two things you
 * want to do next — look at it, or take it back.
 */
export function ChangeCard({
  card,
  sandboxId,
  busy,
  onShow,
  onUndo,
}: {
  card: Card;
  sandboxId: string;
  busy: boolean;
  onShow: (card: Card) => void;
  onUndo: (card: Card) => void;
}) {
  const [showCode, setShowCode] = useState(false);
  const shot = (which: "before" | "after") =>
    `/api/editor/shot?sandboxId=${encodeURIComponent(sandboxId)}&id=${card.id}&which=${which}`;
  const textPairs = readablePairs(card);
  const icon = card.kind === "undo" ? "↶" : card.kind === "text" ? "✎" : "✦";

  return (
    <article
      className={`ed-card-change${card.undone ? " ed-undone" : ""}`}
      aria-label={`Change: ${card.title}`}
    >
      <header>
        <span className="ed-card-icon" aria-hidden="true">
          {icon}
        </span>
        <div className="ed-card-head">
          <strong>{card.title}</strong>
          <span className="ed-card-meta">
            {card.page
              ? pageLabel(card.page)
              : `${card.files.length} file${card.files.length === 1 ? "" : "s"}`}{" "}
            · {timeAgo(card.at)}
            {card.undone ? " · undone" : ""}
          </span>
        </div>
      </header>

      {card.shots.before && card.shots.after ? (
        <Compare
          before={shot("before")}
          after={shot("after")}
          focus={card.focus}
        />
      ) : card.shots.after ? (
        <Crop src={shot("after")} focus={card.focus} label="After" />
      ) : null}

      {textPairs.length > 0 && (
        <div className="ed-card-text">
          {textPairs.map((pair, i) => (
            <p key={i}>
              {wordDiff(pair[0], pair[1]).map((part, j) =>
                part.type === "same" ? (
                  <span key={j}>{part.text}</span>
                ) : part.type === "removed" ? (
                  <del key={j}>{part.text}</del>
                ) : (
                  <ins key={j}>{part.text}</ins>
                ),
              )}
            </p>
          ))}
        </div>
      )}

      {showCode && (
        <pre className="ed-card-code">
          {card.hunks
            .map((h) =>
              [
                `${h.file}`,
                ...h.removed.map((l) => `- ${l.trim()}`),
                ...h.added.map((l) => `+ ${l.trim()}`),
              ].join("\n"),
            )
            .join("\n\n")}
        </pre>
      )}

      <footer>
        {card.page && (
          <button className="ed-link-btn" onClick={() => onShow(card)}>
            Show me
          </button>
        )}
        {card.hunks.length > 0 && (
          <button
            className="ed-link-btn ed-quiet"
            onClick={() => setShowCode((s) => !s)}
          >
            {showCode ? "Hide details" : "Details"}
          </button>
        )}
        <span className="ed-spacer" />
        {card.kind !== "undo" && !card.undone && (
          <button
            className="ed-btn ed-small"
            disabled={busy}
            onClick={() => onUndo(card)}
          >
            Undo
          </button>
        )}
      </footer>
    </article>
  );
}

/** Before/after pairs as readable text, when the change was to words. */
function readablePairs(card: Card): [string, string][] {
  const pairs: [string, string][] = [];
  for (const h of card.hunks) {
    const n = Math.max(h.removed.length, h.added.length);
    for (let i = 0; i < n && pairs.length < 3; i++) {
      const a = humanize(h.removed[i] ?? "");
      const b = humanize(h.added[i] ?? "");
      if (a === b) continue;
      // Only lines that read as words; markup and code stay in Details.
      const wordy = (t: string) =>
        t.length > 0 && /[a-z]{3}/i.test(t) && !/[;{}=<>]/.test(t);
      if ((a && !wordy(a)) || (b && !wordy(b)) || (!a && !b)) continue;
      pairs.push([a, b]);
    }
  }
  return pairs;
}

/**
 * Screenshots are the full page at half scale (640 px wide). The card shows a
 * window onto it, starting a little above where the change landed.
 */
function cropStyle(focus: Card["focus"], width: number) {
  const top = focus ? Math.max(0, focus.y - 160) / 2 : 0;
  // (Positions from narrow frames are not recorded; see Studio's "changed".)
  return { transform: `translateY(-${Math.round(top * (width / 640))}px)` };
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(360);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

function Crop({
  src,
  focus,
  label,
}: {
  src: string;
  focus: Card["focus"];
  label: string;
}) {
  const [failed, setFailed] = useState(false);
  const [ref, width] = useWidth<HTMLDivElement>();
  if (failed) return null;
  return (
    <div className="ed-shot" ref={ref}>
      <img
        src={src}
        alt={`${label} screenshot`}
        style={cropStyle(focus, width)}
        onError={() => setFailed(true)}
      />
      <span className="ed-shot-tag">{label}</span>
    </div>
  );
}

/** Drag the handle to wipe between before and after. */
function Compare({
  before,
  after,
  focus,
}: {
  before: string;
  after: string;
  focus: Card["focus"];
}) {
  const [pos, setPos] = useState(50);
  const [failed, setFailed] = useState(false);
  const [box, width] = useWidth<HTMLDivElement>();
  const dragging = useRef(false);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!dragging.current || !box.current) return;
      const r = box.current.getBoundingClientRect();
      setPos(
        Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)),
      );
    };
    const up = () => (dragging.current = false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, []);

  if (failed) return null;
  const style = cropStyle(focus, width);
  return (
    <div
      className="ed-shot ed-compare"
      ref={box}
      onPointerDown={(e) => {
        dragging.current = true;
        const r = e.currentTarget.getBoundingClientRect();
        setPos(
          Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)),
        );
      }}
      role="slider"
      aria-label="Compare before and after"
      aria-valuenow={Math.round(pos)}
      aria-valuemin={0}
      aria-valuemax={100}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") setPos((p) => Math.max(0, p - 5));
        if (e.key === "ArrowRight") setPos((p) => Math.min(100, p + 5));
      }}
    >
      <img
        src={after}
        alt="After"
        style={style}
        onError={() => setFailed(true)}
        draggable={false}
      />
      <div
        className="ed-compare-before"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      >
        <img
          src={before}
          alt="Before"
          style={style}
          onError={() => setFailed(true)}
          draggable={false}
        />
      </div>
      <div
        className="ed-compare-handle"
        style={{ left: `${pos}%` }}
        aria-hidden="true"
      />
      <span className="ed-shot-tag">Before</span>
      <span className="ed-shot-tag ed-right">After</span>
    </div>
  );
}
