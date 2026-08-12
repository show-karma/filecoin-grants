import type { TierId } from "../../data/kernel";
import { TIERS } from "../../data/kernel";

/**
 * The tier's colour, used for every appearance of it: card headers and bars as
 * a fill, and section headings, row kickers and maintainer flags as text.
 */
const TIER_COLOR: Record<TierId, string> = {
  irreplaceable: "var(--color-tier-irreplaceable)",
  essential: "var(--color-tier-essential)",
  important: "var(--color-tier-important)",
  nice: "var(--color-tier-nice)",
};

export const tierColor = (id: TierId) => TIER_COLOR[id];

/** Display name from the single source of truth, e.g. "Nice to have". */
export const tierName = (id: TierId) =>
  TIERS.find((tier) => tier.id === id)?.name ?? id;
