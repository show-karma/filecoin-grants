import { editorRoute } from "../../../lib/editor/http.ts";

export const prerender = false;

/**
 * A wording change from the fast model: new text for some of the page's text,
 * or `{ok:false}` when the request needs the agent. Writes nothing.
 */
export const POST = editorRoute(async ({ workspace, body }) => {
  const sandbox = await workspace.require(body.sandboxId);
  return workspace.quickEdit(sandbox, {
    request: typeof body.request === "string" ? body.request : "",
    page: typeof body.page === "string" ? body.page : null,
    blocks: body.blocks,
  });
});
