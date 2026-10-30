/*
 * Sign-in for /edit: one shared password (EDITOR_PASSWORD), plus the person's
 * name so commits say who asked for each change.
 *
 * The session is a signed cookie, not a server-side record, so the editor
 * needs no database: `<payload>.<hmac>` where payload is base64url JSON.
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const COOKIE_NAME = "filpgf_editor";
export const SESSION_DAYS = 7;

export type EditorSession = { name: string; exp: number };

const b64url = (buf: Buffer | string) => Buffer.from(buf).toString("base64url");

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createSessionToken(
  name: string,
  secret: string,
  now = Date.now(),
): string {
  if (!secret) throw new Error("EDITOR_SESSION_SECRET is not set");
  const session: EditorSession = { name, exp: now + SESSION_DAYS * 86_400_000 };
  const payload = b64url(JSON.stringify(session));
  return `${payload}.${sign(payload, secret)}`;
}

export function readSessionToken(
  token: string | undefined,
  secret: string,
  now = Date.now(),
): EditorSession | null {
  if (!token || !secret) return null;
  const [payload, mac] = token.split(".");
  if (!payload || !mac) return null;
  const expected = Buffer.from(sign(payload, secret));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given))
    return null;
  try {
    const session = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as EditorSession;
    if (typeof session.name !== "string" || typeof session.exp !== "number")
      return null;
    if (session.exp < now) return null;
    return session;
  } catch {
    return null;
  }
}

/**
 * The key cookies are signed with: the session secret bound to the current
 * password, so changing EDITOR_PASSWORD signs everyone out.
 */
export function signingKey(sessionSecret: string, password: string): string {
  if (!sessionSecret || !password) return "";
  return `${sessionSecret}:${createHash("sha256").update(password).digest("hex")}`;
}

/** The password guards publishing to the live site; refuse weak ones. */
export const MIN_PASSWORD_LENGTH = 12;

/** Constant-time password check. Hashing first evens out the lengths. */
export function passwordMatches(given: string, expected: string): boolean {
  if (!expected) return false;
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/** Names go into commit messages: keep them short and on one line. */
export function cleanName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw
    .replace(/[\u0000-\u001f\u007f<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
  return name.length >= 2 ? name : null;
}
