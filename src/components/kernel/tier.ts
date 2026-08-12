import type { TierId } from "../../data/kernel";

const TIER_COLORS: Record<TierId, string> = {
  irreplaceable: "var(--color-tier-irreplaceable)",
  essential: "var(--color-tier-essential)",
  important: "var(--color-tier-important)",
  nice: "var(--color-tier-nice)",
};

export const tierColor = (id: TierId) => TIER_COLORS[id];
