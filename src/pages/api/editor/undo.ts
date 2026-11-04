import { editorRoute } from "../../../lib/editor/http.ts";

export const prerender = false;

export const POST = editorRoute(async ({ workspace, editor, body }) => {
  const sandbox = await workspace.require(body.sandboxId);
  return workspace.undo(sandbox, editor.name, String(body.id ?? ""));
});
