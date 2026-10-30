/*
 * Shared plumbing for /api/editor/*: sign-in check, same-origin check on
 * writes, JSON in and out, and turning upstream failures into sentences a
 * non-developer can act on.
 */
import type { APIContext, APIRoute } from "astro";
import {
  COOKIE_NAME,
  readSessionToken,
  signingKey,
  type EditorSession,
} from "./auth.ts";
import { BoatError } from "./boat.ts";
import { GitHubError } from "./github.ts";
import { authConfig, editorConfig, missingSettings } from "./config.ts";
import { EditorError, Workspace } from "./workspace.ts";

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export function currentEditor(
  context: Pick<APIContext, "cookies">,
): EditorSession | null {
  const { sessionSecret, password } = authConfig();
  const key = signingKey(sessionSecret ?? "", password ?? "");
  if (!key) return null;
  return readSessionToken(context.cookies.get(COOKIE_NAME)?.value, key);
}

/** Writes must come from this site's own pages. SameSite=Strict covers most of it; this is belt and braces. */
function sameOrigin(request: Request): boolean {
  if (request.method === "GET" || request.method === "HEAD") return true;
  const origin = request.headers.get("origin");
  if (!origin) return false;
  return origin === new URL(request.url).origin;
}

const BOAT_MESSAGES: Record<string, string> = {
  provider_not_configured:
    "The AI agent is not connected yet. In the Boat dashboard, open Agents & Proxying and connect a key or subscription.",
  snapshot_not_found:
    "The editor's workspace template is missing. A developer needs to run scripts/editor/build-template.ts once.",
  unknown_environment:
    "The editor's Boat environment is missing. A developer needs to run scripts/editor/build-template.ts once.",
  rate_limited:
    "Too many workspaces were started recently. Please try again in a minute.",
  limit_reached:
    "Boat's limit on running workspaces is reached. Please try again shortly.",
  billing_required:
    "The Boat account needs billing attention before the editor can start.",
  trial_compute_limit_reached:
    "The Boat trial has run out of hours. The account needs a paid plan.",
  out_of_capacity:
    "Boat has no free machines right now. Please try again in a minute.",
  no_ready_machine:
    "Boat has no free machines right now. Please try again in a minute.",
};

function errorResponse(e: unknown): Response {
  if (e instanceof EditorError) return json({ error: e.message }, e.status);
  if (e instanceof BoatError) {
    console.error("[editor] boat", e.status, e.code, e.message);
    const friendly = BOAT_MESSAGES[e.code];
    return json(
      {
        error:
          friendly ?? "The workspace service had a problem. Please try again.",
        code: e.code,
      },
      e.status === 429 ? 429 : 502,
    );
  }
  if (e instanceof GitHubError) {
    console.error("[editor] github", e.status, e.message);
    const hint =
      e.status === 401 || e.status === 403
        ? "The editor's GitHub token is missing permissions or has expired."
        : "Saving to GitHub failed. Please try again.";
    return json({ error: hint }, 502);
  }
  console.error("[editor] unexpected", e);
  return json({ error: "Something went wrong. Please try again." }, 500);
}

type Handler = (input: {
  context: APIContext;
  editor: EditorSession;
  workspace: Workspace;
  body: Record<string, unknown>;
}) => Promise<unknown>;

/** Wraps an editor endpoint: signed-in, same-origin, configured, JSON. */
export function editorRoute(handler: Handler): APIRoute {
  return async (context) => {
    try {
      const editor = currentEditor(context);
      if (!editor) return json({ error: "Please sign in again." }, 401);
      if (!sameOrigin(context.request))
        return json({ error: "Cross-site request refused." }, 403);
      const missing = missingSettings();
      if (missing.length) {
        return json(
          {
            error: `The editor is not fully set up. Missing: ${missing.join(", ")}.`,
          },
          503,
        );
      }
      let body: Record<string, unknown> = {};
      if (context.request.method !== "GET") {
        body = (await context.request.json().catch(() => ({}))) ?? {};
      }
      const workspace = new Workspace(editorConfig());
      const result = await handler({ context, editor, workspace, body });
      return result instanceof Response ? result : json(result ?? { ok: true });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export { sameOrigin };
