import { editorRoute } from "../../../lib/editor/http.ts";

export const prerender = false;

/** A before/after screenshot from a change card. */
export const GET = editorRoute(async ({ workspace, context }) => {
  const params = context.url.searchParams;
  const sandbox = await workspace.require(params.get("sandboxId"));
  return workspace.shotImage(
    sandbox,
    params.get("id") ?? "",
    params.get("which") === "before" ? "before" : "after",
  );
});
