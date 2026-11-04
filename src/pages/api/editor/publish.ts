import { EditorError } from "../../../lib/editor/workspace.ts";
import { editorRoute } from "../../../lib/editor/http.ts";

export const prerender = false;

function processIdOf(value: unknown): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1)
    throw new EditorError(400, "Missing build id.");
  return n;
}

/** How the publish check is going. */
export const GET = editorRoute(async ({ workspace, context }) => {
  const params = context.url.searchParams;
  const sandbox = await workspace.require(params.get("sandboxId"));
  return workspace.buildStatus(sandbox, processIdOf(params.get("processId")));
});

/**
 * Publishing is two calls so no request waits a minute on a build:
 *   { step: "check" }                 starts `pnpm run build` in the workspace
 *   { step: "ship", processId, ... }  after it passed: save, merge, close
 */
export const POST = editorRoute(async ({ workspace, editor, body }) => {
  const sandbox = await workspace.require(body.sandboxId);
  if (body.step === "check") return workspace.startBuild(sandbox);
  if (body.step === "ship") {
    const requests = Array.isArray(body.requests)
      ? body.requests
          .filter((r): r is string => typeof r === "string")
          .slice(-50)
      : [];
    return workspace.ship(
      sandbox,
      editor.name,
      processIdOf(body.processId),
      requests,
    );
  }
  throw new EditorError(400, "Unknown publish step.");
});
