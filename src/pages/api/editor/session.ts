import { editorRoute } from "../../../lib/editor/http.ts";

export const prerender = false;

/** Is a workspace running, and is its preview ready? Polled while starting. */
export const GET = editorRoute(({ workspace }) => workspace.status());

/** Starts a workspace, or returns the one already running. */
export const POST = editorRoute(({ workspace, body, context }) => {
  const key =
    typeof body.key === "string" && /^[A-Za-z0-9-]{8,64}$/.test(body.key)
      ? body.key
      : crypto.randomUUID();
  return workspace.start(key, context.url.origin);
});

/** Closes the workspace and keeps the draft for next time. */
export const DELETE = editorRoute(async ({ workspace, editor, body }) => {
  const sandbox = await workspace.require(body.sandboxId);
  const summary = typeof body.summary === "string" ? body.summary : "Site edit";
  return workspace.close(sandbox, editor.name, summary, body.save !== false);
});
