import type { Commitment } from "../../data/kernel-api";

/**
 * The API's tier ids, not the local editorial ones in `data/kernel.ts`: the
 * catalogue calls the fourth tier `nice-to-have` where the page copy calls it
 * `nice`. Everything the inventory renders is keyed by the API's spelling, so
 * this module keeps its own map rather than reusing `tier.ts`, which is typed
 * against the editorial ids.
 */
const TIER_COLOR: Record<string, string> = {
  irreplaceable: "var(--color-tier-irreplaceable)",
  essential: "var(--color-tier-essential)",
  important: "var(--color-tier-important)",
  "nice-to-have": "var(--color-tier-nice)",
};

const TIER_LABEL: Record<string, string> = {
  irreplaceable: "Irreplaceable",
  essential: "Essential",
  important: "Important",
  "nice-to-have": "Nice to have",
};

/** Most-irreplaceable first — the order the tier tables and cards read in. */
export const TIER_ORDER = [
  "irreplaceable",
  "essential",
  "important",
  "nice-to-have",
];

export const tierColor = (tier: string) =>
  TIER_COLOR[tier] ?? "var(--color-muted)";

export const tierLabel = (tier: string) => TIER_LABEL[tier] ?? tier;

/**
 * A tier with nothing catalogued says so in prose instead of rendering an
 * empty list, so the reader can tell "not inventoried" from "inventoried and
 * healthy". Copy carried over from the hardcoded inventory this replaces.
 */
export const PENDING_NOTE: Record<string, string> = {
  important:
    "Functions in this tier have not been inventoried yet. Posture is set — fund maintenance, not features — but nothing is being measured against it.",
  "nice-to-have":
    "Functions in this tier have not been inventoried yet. Posture is set — discretionary — but nothing is being measured against it.",
};

/**
 * Human names for the funded teams, keyed on `osoProjectSlug`.
 *
 * The API carries no display name — `team` is a slug, and it is not even
 * unique: ChainSafe holds two awards and both rows arrive as `chainsafe`,
 * indistinguishable to a reader. `osoProjectSlug` is distinct per award
 * (`forest-chainsafe` vs `filecoin-community-services-chainsafe`), so it is
 * the key, and the value names the work rather than only the company.
 *
 * An unmapped team degrades to its humanised slug rather than disappearing, so
 * a team added upstream renders as `Fil B` until someone writes its real name
 * here — never as a blank row.
 */
export const TEAM_DISPLAY_NAME: Record<string, string> = {
  drand: "drand / Randamu",
  "ankr-network": "Ankr",
  blockscout: "Blockscout",
  "chain-love": "Chain.Love",
  "forest-chainsafe": "Forest / ChainSafe",
  "filecoin-community-services-chainsafe":
    "Filecoin Community Services / ChainSafe",
  "fil-builders": "Filecoin Docs / FIL-B",
  "filecoin-data-portal-davidgasquez": "Filecoin Data Portal",
  filozone: "Curio / FilOz",
  goldsky: "Goldsky",
  ipni: "IPNI / OIF",
  "reiers-filecoin": "Plumbline",
  zondax: "Zondax",
  "secured-finance": "USDFC / Secured Finance",
};

/** `filecoin-data-portal` → `Filecoin Data Portal`; short words stay acronyms. */
const humanise = (slug: string) =>
  slug
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) =>
      word.length <= 3
        ? word.toUpperCase()
        : word[0].toUpperCase() + word.slice(1),
    )
    .join(" ");

export const teamDisplayName = (
  osoProjectSlug: string | null | undefined,
  team: string | null | undefined,
) => {
  const mapped = osoProjectSlug ? TEAM_DISPLAY_NAME[osoProjectSlug] : undefined;
  return mapped ?? humanise(team ?? osoProjectSlug ?? "unnamed team");
};

/** One coloured segment of the kicker line above a card's title. */
export type Kicker = { text: string; color?: string };

/**
 * Flags read left to right under the title. `warn` is exposure the programme
 * accepts (a lone maintainer); `bad` is a hole in the record — nothing is being
 * measured at all.
 */
export type Flag = { text: string; tone: "ink" | "muted" | "warn" | "bad" };

export type MetaItem = { label: string; value: string };

/**
 * Everything one collapsed row and its expanded body need. Built in
 * InventoryPanel for both tabs so InventoryCard renders and never derives.
 */
export type CardRow = {
  /** Unique across both tabs — the same team can appear in either panel. */
  id: string;
  kicker: Kicker[];
  title: string;
  flags: Flag[];
  /** Share of the largest award, 0–1. Null where money is not the subject. */
  share?: number | null;
  metPct: number | null;
  commitments: Commitment[];
  prose?: string | null;
  meta: MetaItem[];
  /** Shown in the expanded body when nothing reports against this row. */
  emptyNote: string;
};

export const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

/**
 * `$1.48M` / `$213k`, null for nothing committed — the data module owns the
 * rounding so every surface on the page agrees on it.
 */
export { formatUsd as usd } from "../../data/kernel-api";

/*
 * Counting commitments belongs to `kernel-api.ts` (`uniqueCommitments` /
 * `commitmentCounts`): the same indicator can arrive under two projects or two
 * functions, and a local `.length` here is exactly how this section and the
 * metrics tiles came to quote different totals.
 */

/**
 * Display threshold for the "meeting" chip. The API scores each reading but
 * publishes no verdict, so the page has to draw the line itself; it is a
 * presentation choice and moves the moment the API carries one.
 */
export const MEETING_MIN_PCT = 95;

export type SlaStatus = "meeting" | "missing" | "unmeasured";

/**
 * No threshold anywhere in the catalogue today, so `metPct` is null on every
 * row. That is `unmeasured` — never 0%, which would read as a total outage.
 */
export const slaStatus = (metPct: number | null): SlaStatus =>
  metPct === null
    ? "unmeasured"
    : metPct >= MEETING_MIN_PCT
      ? "meeting"
      : "missing";

export const slaPctLabel = (metPct: number | null) =>
  metPct === null ? "—" : `${metPct.toFixed(1)}%`;
