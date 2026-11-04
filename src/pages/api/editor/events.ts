import { editorRoute } from "../../../lib/editor/http.ts";

export const prerender = false;

/** The agent's messages and activity since `cursor`, plus the state of `promptId`. */
export const GET = editorRoute(async ({ workspace, context }) => {
  const params = context.url.searchParams;
  const sandbox = await workspace.require(params.get("sandboxId"));
  return workspace.events(
    sandbox,
    params.get("cursor") || undefined,
    params.get("promptId") || undefined,
  );
});
