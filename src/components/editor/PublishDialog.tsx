import { useEffect, useState } from "react";
import type { Card } from "./api.ts";
import { pageLabel } from "./util.ts";

export type Publish =
  | { step: "idle" }
  | { step: "confirm" }
  | { step: "checking"; processId: number; startedAt: number }
  | { step: "failed"; log: string }
  | { step: "shipping" }
  | { step: "done"; prUrl: string }
  | { step: "review"; prUrl: string }
  | { step: "blocked"; reason: string; prUrl?: string };

const STEPS = ["Check the site", "Publish", "Live"];

export function PublishDialog({
  publish,
  cards,
  draftFromEarlier,
  onConfirm,
  onCancel,
  onAskFix,
  onDone,
}: {
  publish: Publish;
  cards: Card[];
  draftFromEarlier: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onAskFix: (log: string) => void;
  onDone: (message: string) => void;
}) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === "Escape" &&
        (publish.step === "confirm" ||
          publish.step === "failed" ||
          publish.step === "blocked")
      )
        onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [publish.step, onCancel]);

  const live = cards.filter((c) => !c.undone && c.kind !== "undo");
  const stage =
    publish.step === "checking"
      ? 0
      : publish.step === "shipping"
        ? 1
        : publish.step === "done"
          ? 3
          : -1;

  return (
    <div
      className="ed-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ed-publish-title"
    >
      <div className="ed-dialog">
        {stage >= 0 && (
          <ol className="ed-progress" aria-label="Publishing progress">
            {STEPS.map((s, i) => (
              <li
                key={s}
                className={i < stage ? "ed-done" : i === stage ? "ed-now" : ""}
              >
                <span>{i < stage ? "✓" : i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
        )}

        {publish.step === "confirm" && (
          <>
            <h2 id="ed-publish-title">Publish to www.filpgf.io?</h2>
            {live.length > 0 ? (
              <ul className="ed-publish-list">
                {live.slice(-12).map((c) => (
                  <li key={c.id}>
                    <strong>{c.title}</strong>
                    {c.page && <span>{pageLabel(c.page)}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p>Your saved, unpublished changes will go live.</p>
            )}
            {draftFromEarlier && live.length > 0 && (
              <p className="ed-muted">
                Plus the changes saved in an earlier session.
              </p>
            )}
            <p className="ed-muted">
              The site is checked first. If anything is wrong, nothing is
              published.
            </p>
            <div className="ed-row">
              <button
                className="ed-btn ed-primary"
                onClick={onConfirm}
                autoFocus
              >
                Publish
              </button>
              <button className="ed-btn" onClick={onCancel}>
                Not yet
              </button>
            </div>
          </>
        )}

        {publish.step === "checking" && (
          <div className="ed-center-col" aria-live="polite">
            <h2 id="ed-publish-title">Checking the site</h2>
            <p className="ed-muted">
              Building every page the way the live site does.{" "}
              {Math.round((Date.now() - publish.startedAt) / 1000)}s · usually
              about a minute.
            </p>
          </div>
        )}

        {publish.step === "shipping" && (
          <div className="ed-center-col" aria-live="polite">
            <h2 id="ed-publish-title">Publishing</h2>
            <p className="ed-muted">Everything checked out. Sending it live…</p>
          </div>
        )}

        {publish.step === "failed" && (
          <>
            <h2 id="ed-publish-title">The check found a problem</h2>
            <p>
              Nothing was published. The assistant can usually fix this in a
              minute.
            </p>
            <details>
              <summary>Details for a developer</summary>
              <pre className="ed-log">{publish.log}</pre>
            </details>
            <div className="ed-row">
              <button
                className="ed-btn ed-primary"
                onClick={() => onAskFix(publish.log)}
              >
                Ask the assistant to fix it
              </button>
              <button className="ed-btn" onClick={onCancel}>
                Close
              </button>
            </div>
          </>
        )}

        {publish.step === "blocked" && (
          <>
            <h2 id="ed-publish-title">Not published</h2>
            <p>{publish.reason}</p>
            {publish.prUrl && (
              <p>
                <a href={publish.prUrl} target="_blank" rel="noreferrer">
                  Open the pull request
                </a>
              </p>
            )}
            <div className="ed-row">
              <button className="ed-btn" onClick={onCancel}>
                Close
              </button>
            </div>
          </>
        )}

        {publish.step === "review" && (
          <>
            <h2 id="ed-publish-title">Sent for review</h2>
            <p>A developer will check the changes and publish them.</p>
            <p>
              <a href={publish.prUrl} target="_blank" rel="noreferrer">
                See the request
              </a>
            </p>
            <div className="ed-row">
              <button
                className="ed-btn ed-primary"
                onClick={() =>
                  onDone("Sent for review. A developer will publish it.")
                }
              >
                Done
              </button>
            </div>
          </>
        )}

        {publish.step === "done" && (
          <>
            <h2 id="ed-publish-title">Published</h2>
            <p>The live site updates in about a minute.</p>
            <p className="ed-row">
              <a
                className="ed-btn"
                href="https://www.filpgf.io"
                target="_blank"
                rel="noreferrer"
              >
                Open www.filpgf.io
              </a>
              <a href={publish.prUrl} target="_blank" rel="noreferrer">
                Record of this change
              </a>
            </p>
            <div className="ed-row">
              <button
                className="ed-btn ed-primary"
                onClick={() =>
                  onDone("Published. The live site updates in about a minute.")
                }
              >
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
