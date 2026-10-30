import { useCallback, useEffect, useState } from "react";
import { ApiError, api, sleep, type SessionView } from "./api.ts";
import { Studio } from "./Studio.tsx";
import "./editor.css";

type Props = { signedInAs: string | null; missing: string[] };

export default function EditorApp({ signedInAs, missing }: Props) {
  const [name, setName] = useState(signedInAs);
  if (missing.length > 0) return <SetupNeeded missing={missing} />;
  if (!name) return <SignIn onSignedIn={setName} />;
  return <Editor name={name} onSignedOut={() => setName(null)} />;
}

// ---- Sign-in ------------------------------------------------------------------

function SignIn({ onSignedIn }: { onSignedIn: (name: string) => void }) {
  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem("filpgf-editor-name") ?? "";
    } catch {
      return "";
    }
  });
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ name: string }>("login", {
        method: "POST",
        body: { name, password },
      });
      try {
        localStorage.setItem("filpgf-editor-name", res.name);
      } catch {
        // Remembering the name is a convenience only.
      }
      onSignedIn(res.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="ed-center">
      <form className="ed-card" onSubmit={submit}>
        <h1>Edit filpgf.io</h1>
        <p className="ed-muted">
          Describe a change in plain words, see it in a live preview, then
          publish it.
        </p>
        <label>
          Your name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            required
            minLength={2}
          />
        </label>
        <label>
          Editor password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error && (
          <p className="ed-error" role="alert">
            {error}
          </p>
        )}
        <button className="ed-btn ed-primary" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}

function SetupNeeded({ missing }: { missing: string[] }) {
  return (
    <main className="ed-center">
      <div className="ed-card">
        <h1>The editor is not set up yet</h1>
        <p>These settings are missing on the server:</p>
        <ul>
          {missing.map((m) => (
            <li key={m}>
              <code>{m}</code>
            </li>
          ))}
        </ul>
        <p className="ed-muted">See “Site editor” in the repository README.</p>
      </div>
    </main>
  );
}

// ---- The editor ---------------------------------------------------------------

function Editor({
  name,
  onSignedOut,
}: {
  name: string;
  onSignedOut: () => void;
}) {
  const [session, setSession] = useState<SessionView | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [startedAt] = useState(() => Date.now());
  // One key per page load: Boat treats repeated starts with it as one start.
  const [startKey] = useState(() => crypto.randomUUID());
  const [now, setNow] = useState(() => Date.now());
  const [closed, setClosed] = useState<string | null>(null);

  const signOutOn401 = useCallback(
    (e: unknown) => {
      if (e instanceof ApiError && e.status === 401) onSignedOut();
    },
    [onSignedOut],
  );

  // Start (or rejoin) the workspace, then poll until the preview is up.
  useEffect(() => {
    if (closed) return;
    let cancelled = false;
    (async () => {
      try {
        let view = await api<SessionView>("session");
        if (view.state === "none")
          view = await api<SessionView>("session", {
            method: "POST",
            body: { key: startKey },
          });
        while (!cancelled) {
          setSession(view);
          if (view.state === "ready" || view.state === "error") return;
          await sleep(1500);
          view = await api<SessionView>("session");
          if (view.state === "none")
            view = await api<SessionView>("session", {
              method: "POST",
              body: { key: startKey },
            });
        }
      } catch (e) {
        signOutOn401(e);
        if (!cancelled)
          setStartError(
            e instanceof Error ? e.message : "Could not start the workspace.",
          );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [closed, signOutOn401, startKey]);

  useEffect(() => {
    if (session?.state === "ready") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [session?.state]);

  const signOut = async () => {
    await api("logout", { method: "POST" }).catch(() => undefined);
    onSignedOut();
  };

  if (closed) {
    return (
      <main className="ed-center">
        <div className="ed-card">
          <h1>{closed}</h1>
          <button
            className="ed-btn ed-primary"
            onClick={() => location.reload()}
          >
            Start a new edit
          </button>
          <a className="ed-link" href="/">
            Go to the site
          </a>
        </div>
      </main>
    );
  }

  if (startError || session?.state === "error") {
    return (
      <main className="ed-center">
        <div className="ed-card">
          <h1>The workspace didn't start</h1>
          <p className="ed-error">{startError ?? session?.error}</p>
          {session?.log && (
            <details>
              <summary>Details for a developer</summary>
              <pre className="ed-log">{session.log}</pre>
            </details>
          )}
          <div className="ed-row">
            <button
              className="ed-btn ed-primary"
              onClick={() => location.reload()}
            >
              Try again
            </button>
            {session?.sandboxId && (
              <button
                className="ed-btn"
                onClick={async () => {
                  // Start over from the saved draft. Nothing to save from a
                  // workspace that never opened.
                  await api("session", {
                    method: "DELETE",
                    body: { sandboxId: session.sandboxId, save: false },
                  }).catch(() => undefined);
                  location.reload();
                }}
              >
                Start over
              </button>
            )}
            {session?.draft.exists && (
              <button
                className="ed-btn"
                onClick={async () => {
                  if (
                    !window.confirm(
                      "Throw away every unpublished change? This cannot be undone.",
                    )
                  )
                    return;
                  await api("discard", {
                    method: "POST",
                    body: { sandboxId: session.sandboxId },
                  }).catch(() => undefined);
                  location.reload();
                }}
              >
                Throw away unpublished changes
              </button>
            )}
          </div>
        </div>
      </main>
    );
  }

  if (
    !session ||
    session.state !== "ready" ||
    !session.previewUrl ||
    !session.sandboxId
  ) {
    const seconds = Math.max(0, Math.round((now - startedAt) / 1000));
    return (
      <main className="ed-center">
        <div className="ed-card ed-loading" aria-live="polite">
          <div className="ed-spinner" aria-hidden="true" />
          <h1>Getting the editor ready</h1>
          <p>{session?.detail ?? "Checking for a running workspace…"}</p>
          <p className="ed-muted">
            {seconds}s · usually 15 to 30 seconds
            {session?.draft.exists
              ? " · your unpublished changes will be loaded"
              : ""}
          </p>
        </div>
      </main>
    );
  }

  return (
    <Studio
      name={name}
      sandboxId={session.sandboxId}
      previewUrl={session.previewUrl}
      draftAtStart={session.draft.exists}
      onSignOut={signOut}
      onAuthLost={onSignedOut}
      onClosed={setClosed}
    />
  );
}
