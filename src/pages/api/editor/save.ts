import { editorRoute } from "../../../lib/editor/http.ts";
import { focusOf } from "../../../lib/editor/validate.ts";

export const prerender = false;

/**
 * Saves what changed since the last save to the draft branch. Called after
 * every turn; with `card`, it also records a change card for the timeline.
 */
export const POST = editorRoute(async ({ workspace, editor, body }) => {
  const sandbox = await workspace.require(body.sandboxId);
  const summary = typeof body.summary === "string" ? body.summary : "Site edit";
  if (body.card !== true) return workspace.save(sandbox, editor.name, summary);
  return workspace.save(sandbox, editor.name, summary, {
    kind: "agent",
    page: typeof body.page === "string" ? body.page : null,
    focus: focusOf(body.focus),
    shotId: typeof body.shotId === "string" ? body.shotId : null,
    promptId: typeof body.promptId === "string" ? body.promptId : null,
  });
});
