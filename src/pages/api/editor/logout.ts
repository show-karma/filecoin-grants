import type { APIRoute } from "astro";
import { COOKIE_NAME } from "../../../lib/editor/auth.ts";
import { json, sameOrigin } from "../../../lib/editor/http.ts";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!sameOrigin(request))
    return json({ error: "Cross-site request refused." }, 403);
  cookies.delete(COOKIE_NAME, { path: "/" });
  return json({ ok: true });
};
