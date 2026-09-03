import type { Commitment, KernelCoverage } from "../../data/kernel-api";
import { cadenceDays, dayIndex } from "./uptime";

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
  /** Reading coverage as a fraction, 0–1. Null where nothing is collected. */
  share?: number | null;
  /**
   * The functions this row's own commitments name, with the tier each sits in.
   * A count told a reader a team covers two functions without ever saying
   * which, which is the only part of that sentence they came for.
   */
  evidenced?: { tier: string; name: string }[];
  /** Collection completeness — the headline figure on every inventory card. */
  coverage: KernelCoverage | null;
  commitments: Commitment[];
  /** Freshest reading anywhere on the page, the reference silence is measured against. */
  asOf?: string | null;
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
 * How long a row has been silent, measured against the freshest reading on the
 * page rather than against today — the sync lands a day behind, and charging a
 * team for our own ingestion lag is the mistake this whole figure exists to
 * avoid.
 *
 * Null when the row has never reported.
 */
export const daysSilent = (
  commitments: Commitment[],
  asOf: string | null,
): number | null => {
  if (!asOf) return null;
  const latest = commitments
    .map((commitment) => commitment.latest?.date)
    .filter((date): date is string => Boolean(date))
    .sort()
    .at(-1);
  return latest ? dayIndex(asOf) - dayIndex(latest) : null;
};

/**
 * The interval this row promises a reading in: the finest cadence among its
 * commitments, because one daily metric going quiet is news even when the
 * monthly ones beside it are not yet due.
 */
export const promisedIntervalDays = (commitments: Commitment[]): number =>
  commitments.length === 0
    ? 1
    : Math.min(...commitments.map((c) => cadenceDays(c.cadence)));

export type CollectionStatus = "collecting" | "silent" | "never";

/**
 * A row is silent once it has missed the interval it promised — a daily metric
 * quiet for two days has stopped reporting, a monthly one has not.
 *
 * Deliberately not a percentage: the threshold that used to live here was 95%,
 * inherited from the SLA status it replaced, and nothing about coverage made
 * that number mean anything. Time since the last reading is a claim a reader
 * can check.
 */
export const collectionStatus = (
  commitments: Commitment[],
  asOf: string | null,
): CollectionStatus => {
  const silent = daysSilent(commitments, asOf);
  if (silent === null) return "never";
  return silent > promisedIntervalDays(commitments) ? "silent" : "collecting";
};

export const coveragePctLabel = (coverage: KernelCoverage | null) =>
  !coverage || coverage.pct === null ? "—" : `${coverage.pct.toFixed(1)}%`;
