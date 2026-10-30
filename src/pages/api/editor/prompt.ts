import { editorRoute } from "../../../lib/editor/http.ts";

export const prerender = false;

export const POST = editorRoute(async ({ workspace, body }) => {
  const sandbox = await workspace.require(body.sandboxId);
  return workspace.prompt(
    sandbox,
    typeof body.text === "string" ? body.text : "",
    {
      mode:
        body.mode === "quick" || body.mode === "deep" ? body.mode : undefined,
      hasSelection: body.hasSelection === true,
      page: typeof body.page === "string" ? body.page : null,
    },
  );
});
