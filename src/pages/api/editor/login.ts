import type { APIRoute } from "astro";
import {
  COOKIE_NAME,
  MIN_PASSWORD_LENGTH,
  SESSION_DAYS,
  cleanName,
  createSessionToken,
  passwordMatches,
  signingKey,
} from "../../../lib/editor/auth.ts";
import { authConfig } from "../../../lib/editor/config.ts";
import { json, sameOrigin } from "../../../lib/editor/http.ts";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!sameOrigin(request))
    return json({ error: "Cross-site request refused." }, 403);
  const { password, sessionSecret } = authConfig();
  if (!password || !sessionSecret) {
    return json(
      {
        error:
          "The editor is not set up yet (EDITOR_PASSWORD, EDITOR_SESSION_SECRET).",
      },
      503,
    );
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return json(
      {
        error: `EDITOR_PASSWORD is too short; use at least ${MIN_PASSWORD_LENGTH} characters.`,
      },
      503,
    );
  }
  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const name = cleanName(body.name);
  if (!name) return json({ error: "Please enter your name." }, 400);
  if (
    typeof body.password !== "string" ||
    !passwordMatches(body.password, password)
  ) {
    // Slows down guessing from one client. Parallel guessing needs a real
    // limit: see "Safety" in the README (Vercel firewall rule).
    await new Promise((r) => setTimeout(r, 800));
    return json({ error: "That password is not right." }, 401);
  }
  cookies.set(
    COOKIE_NAME,
    createSessionToken(name, signingKey(sessionSecret, password)),
    {
      httpOnly: true,
      secure: import.meta.env.PROD,
      sameSite: "strict",
      path: "/",
      maxAge: SESSION_DAYS * 86_400,
    },
  );
  return json({ ok: true, name });
};
