import { editorRoute } from "../../../lib/editor/http.ts";
import { cleanEdits } from "../../../lib/editor/workspace.ts";
import { focusOf } from "../../../lib/editor/validate.ts";

export const prerender = false;

/**
 * Text changed without the agent (typed over in the preview, or from a quick
 * edit), written straight into the source and saved. `{ok:false}` means "ask
 * the agent".
 */
export const POST = editorRoute(async ({ workspace, editor, body }) => {
  const sandbox = await workspace.require(body.sandboxId);
  const edits =
    cleanEdits(body.edits) ??
    cleanEdits([{ before: body.before, after: body.after, file: body.file }]);
  if (!edits) return { ok: false };
  const result = await workspace.textEdit(sandbox, editor.name, {
    edits,
    summary: typeof body.summary === "string" ? body.summary : undefined,
    page: typeof body.page === "string" ? body.page : null,
    focus: focusOf(body.focus),
  });
  return result ? { ok: true, ...result } : { ok: false };
});
