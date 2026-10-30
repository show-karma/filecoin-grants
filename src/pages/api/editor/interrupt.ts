import { editorRoute } from "../../../lib/editor/http.ts";

export const prerender = false;

export const POST = editorRoute(async ({ workspace, body }) => {
  const sandbox = await workspace.require(body.sandboxId);
  await workspace.interrupt(sandbox);
  return { ok: true };
});
