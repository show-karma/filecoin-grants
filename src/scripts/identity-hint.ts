import { IDENTITY_HINT } from "../data/site";

/**
 * Reading the identity hint — the cookie the app writes on the shared parent
 * domain to tell this site who is signed in.
 *
 * Lives here because more than one part of the header depends on it (the
 * account button, and the links that only make sense with an account), and two
 * copies of a cookie parser is how the two end up disagreeing about whether
 * anyone is signed in.
 *
 * IT IS NOT A CREDENTIAL. It decides what this page draws, nothing more: every
 * control it reveals is a link into the app, which re-derives the session and
 * decides for real. A stale hint therefore costs a wrong-looking header until
 * the next navigation, and can grant nothing — which is the property that makes
 * reading it acceptable on a static page at all.
 */
export interface IdentityHint {
  v: number;
  name?: string;
  avatar?: string;
  address?: string;
}

export function readIdentityHint(): IdentityHint | null {
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${IDENTITY_HINT.cookie}=([^;]*)`),
  );
  if (!match) return null;

  try {
    const parsed = JSON.parse(decodeURIComponent(match[1])) as IdentityHint;
    // Only the shape this build knows how to draw. A newer app writing a newer
    // one falls back to the signed-out header rather than rendering nonsense.
    return parsed?.v === 1 && parsed.name ? parsed : null;
  } catch {
    // SUPPRESSED: a truncated or hand-edited cookie is not worth reporting from
    // a static page — the header simply stays in its signed-out state.
    return null;
  }
}
