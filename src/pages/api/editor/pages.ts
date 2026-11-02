import { editorRoute } from "../../../lib/editor/http.ts";

export const prerender = false;

/** The site's pages as they are in the workspace right now, new ones included. */
export const GET = editorRoute(async ({ workspace, context }) => {
  const sandbox = await workspace.require(
    context.url.searchParams.get("sandboxId"),
  );
  return { pages: await workspace.pages(sandbox) };
});
