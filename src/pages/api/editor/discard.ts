import { editorRoute } from "../../../lib/editor/http.ts";

export const prerender = false;

/** Throws away the draft and closes the workspace. */
export const POST = editorRoute(async ({ workspace, body }) => {
  const sandbox = body.sandboxId
    ? await workspace.require(body.sandboxId).catch(() => null)
    : null;
  await workspace.discard(sandbox);
  return { ok: true };
});
