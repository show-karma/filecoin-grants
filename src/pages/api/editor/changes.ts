import { editorRoute } from "../../../lib/editor/http.ts";
import { focusOf } from "../../../lib/editor/validate.ts";
import { EditorError } from "../../../lib/editor/workspace.ts";

export const prerender = false;

/** The change cards of this session. */
export const GET = editorRoute(async ({ workspace, context }) => {
  const sandbox = await workspace.require(
    context.url.searchParams.get("sandboxId"),
  );
  return { cards: await workspace.cards(sandbox) };
});

/** Adds where on the page a change landed, once the preview has spotted it. */
export const POST = editorRoute(async ({ workspace, body }) => {
  const sandbox = await workspace.require(body.sandboxId);
  const focus = focusOf(body.focus);
  if (!focus) throw new EditorError(400, "Missing position.");
  await workspace.focusCard(sandbox, String(body.id ?? ""), focus);
  return { ok: true };
});
