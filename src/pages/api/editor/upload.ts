import { EditorError } from "../../../lib/editor/workspace.ts";
import { editorRoute } from "../../../lib/editor/http.ts";

export const prerender = false;

/** An image for the site (kind "site") or for the agent to look at (kind "reference"). */
export const POST = editorRoute(async ({ workspace, body }) => {
  const sandbox = await workspace.require(body.sandboxId);
  if (body.kind !== "site" && body.kind !== "reference")
    throw new EditorError(400, "Unknown upload.");
  return workspace.upload(sandbox, {
    kind: body.kind,
    name: String(body.name ?? "image"),
    mime: String(body.mime ?? ""),
    data: String(body.data ?? ""),
  });
});
