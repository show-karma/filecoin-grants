import { editorRoute } from "../../../lib/editor/http.ts";

export const prerender = false;

/** Changes saved in earlier sessions, which a publish from this one would carry. */
export const GET = editorRoute(async ({ workspace, context }) => {
  const sandbox = await workspace.require(
    context.url.searchParams.get("sandboxId"),
  );
  return { earlier: await workspace.earlierChanges(sandbox) };
});
