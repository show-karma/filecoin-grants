import type { TierId } from "../../data/kernel";
import { TIERS } from "../../data/kernel";

/** Saturated fill, for card headers and rules that carry white text. */
const TIER_FILL: Record<TierId, string> = {
  irreplaceable: "var(--color-tier-irreplaceable)",
  essential: "var(--color-tier-essential)",
  important: "var(--color-tier-important)",
  nice: "var(--color-tier-nice)",
};

/**
 * Darker variant for the same colour used as text on white or the tint, where
 * the fill would fall below the 4.5:1 contrast minimum.
 */
const TIER_TEXT: Record<TierId, string> = {
  irreplaceable: "var(--color-tier-irreplaceable-text)",
  essential: "var(--color-tier-essential-text)",
  important: "var(--color-tier-important-text)",
  nice: "var(--color-tier-nice-text)",
};

export const tierColor = (id: TierId) => TIER_FILL[id];
export const tierTextColor = (id: TierId) => TIER_TEXT[id];

/** Display name from the single source of truth, e.g. "Nice to have". */
export const tierName = (id: TierId) =>
  TIERS.find((tier) => tier.id === id)?.name ?? id;
