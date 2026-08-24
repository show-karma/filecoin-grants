/**
 * Kernel program page — editorial copy.
 *
 * Live counts, SLA and money now come from `kernel-api.ts`. What stays here is
 * the prose the API does not carry: the tier rules, postures and examples, the
 * timeline and the glossary. The two are reconciled at the component boundary,
 * so a tier's wording and its numbers can never drift apart in a data file.
 *
 * There are deliberately no figures in this file. Counts and percentages once
 * transcribed from the design mockup lived here as a fallback for when the API
 * could not be read; a build-time blip then printed invented SLA percentages as
 * current fact, which is the one failure this page exists to prevent. When the
 * API is silent the page now says so.
 */

export type TierId = "irreplaceable" | "essential" | "important" | "nice";

export type Tier = {
  id: TierId;
  /**
   * The tier string the Kernel API uses. It differs from {@link TierId} for
   * "nice to have", so the join is spelled out rather than guessed from the id.
   */
  apiId: string;
  name: string;
  /** One-line rule that decides whether a function belongs in this tier. */
  rule: string;
  detail: string;
  example: string;
  posture: string;
  /** Short posture phrasing used in the overview table. */
  postureShort: string;
  /**
   * How many functions are catalogued in this tier. Always null in {@link
   * TIERS} — the count belongs to the API, and the page injects it at the call
   * site. Null therefore reads as "nobody has told us", which is exactly the
   * state a tier is in when the API cannot be reached.
   */
  functions: number | null;
};

export const TIERS: Tier[] = [
  {
    id: "irreplaceable",
    apiId: "irreplaceable",
    name: "Irreplaceable",
    rule: "Only provider. Network halts without it. No substitute exists.",
    detail:
      "Ledger, resource, and programmability — what the blockchain and the physical-storage-backed ledger need in order to keep running at all.",
    example:
      "Distributed randomness beacon — without it, block production stops.",
    posture:
      "Must fund. Non-negotiable security requirements. Audits milestone-gated.",
    postureShort: "Must fund — non-negotiable",
    functions: null,
  },
  {
    id: "essential",
    apiId: "essential",
    name: "Essential",
    rule: "Network-critical, but alternatives exist. We need at least one.",
    detail:
      "Core offerings — disk space from miners, storage primitives in smart contracts — that let participants engage with the irreplaceable components.",
    example:
      "Testnets: the network continues without them, but at least one is needed to stage and rehearse upgrades.",
    posture:
      "Fund for diversity that ensures uptime — maintain two or more implementations. Budget negotiable.",
    postureShort: "Fund for redundancy — 2+ implementations",
    functions: null,
  },
  {
    id: "important",
    apiId: "important",
    name: "Important",
    rule: "Load-bearing. Multiple dependents. Silent failure cascades.",
    detail:
      "Supports and improves access to the critical components, and speeds up development of revenue-generating work.",
    example:
      "A testnet faucet: it makes test FIL easy to get, but the network runs without it.",
    posture:
      "Fund maintenance, not features. Flag any repo with zero active developers.",
    postureShort: "Fund maintenance, not features",
    functions: null,
  },
  {
    id: "nice",
    apiId: "nice-to-have",
    name: "Nice to have",
    rule: "Enriches the ecosystem. Network survives without it.",
    detail:
      "Initiatives that encourage additional growth, where having even one instance may matter for basic ecosystem support.",
    example:
      "F3: the network exists without it, but it improves UX considerably and encourages growth.",
    posture:
      "Discretionary. Fund only where aligned with the sustainability strategy.",
    postureShort: "Discretionary",
    functions: null,
  },
];

export type TimelineStep = {
  date: string;
  label: string;
  state: "done" | "current" | "upcoming";
};

export const TIMELINE: TimelineStep[] = [
  { date: "Jan 2026", label: "FY26 term begins", state: "done" },
  { date: "Apr 2026", label: "Mid-term audit cleared", state: "done" },
  { date: "Aug 2026", label: "Health reporting live", state: "current" },
  {
    date: "Oct 2026",
    label: "Close-out audit · FY27 intake opens",
    state: "upcoming",
  },
  { date: "Nov 2026", label: "Applications close", state: "upcoming" },
  { date: "Dec 2026", label: "Awards published", state: "upcoming" },
  { date: "Jan 2027", label: "FY27 term begins", state: "upcoming" },
];

export const NEXT_ROUND = {
  eyebrow: "Next round opening",
  title: "FY27 intake opens October 2026",
  description:
    "Applications close in November, awards are published in December, and the new term begins in January. Existing grantees re-apply on the same cycle.",
  ctaText: "Apply",
  ctaHref: "https://app.filpgf.io/programs/1479/",
};

/**
 * One tile in the metrics grid. The values are derived from the live program
 * summary in MetricGrid.astro — nothing here is transcribed any more.
 */
export type KernelMetric = {
  value: string;
  label: string;
  note: string;
  /** Renders the note in the warning colour when the number is a risk. */
  noteTone?: "muted" | "warn";
};

export type GlossaryEntry = { term: string; definition: string };

export const GLOSSARY: GlossaryEntry[] = [
  {
    term: "Kernel",
    definition:
      "The funding program covering work the network cannot operate without. Funded as a **near-fixed cost** on an annual term with audits, not against milestones.",
  },
  {
    term: "Function",
    definition:
      "A capability the network needs, named by **what it does** rather than by which repo provides it. Functions outlive implementations — the function survives when the code that serves it is replaced.",
  },
  {
    term: "Dependency",
    definition:
      "A library, service, or system a function relies on to work. A dependency with one maintainer and no substitute is a risk to every function above it.",
  },
  {
    term: "Tier",
    definition:
      "How replaceable a function is, from **Irreplaceable** to **Nice to have**. Tier sets the funding posture and whether redundancy is required.",
  },
  {
    term: "Health metric",
    definition:
      "A commitment with a threshold, a reading cadence and a public endpoint, reported by the maintaining team. Every reading is either met or missed. A function with no health metric cannot be assessed at all and is marked **not measured**.",
  },
  {
    term: "Growth counter",
    definition:
      "A commitment tracked for **direction, never pass/fail**. Growth counters carry no threshold, never colour red, and never contribute to the SLA figure.",
  },
  {
    term: "SLA met · 90d",
    definition:
      "The share of reading periods in the last 90 days that sat within threshold, counted at **each metric's own cadence** rather than per day. A rolling window, so it reflects current condition rather than a single check.",
  },
  {
    term: "Coverage",
    definition:
      "How much of the window was actually read — readings present against the periods the cadence expects, as in **90 of 90 days read**. Thin coverage means the SLA figure above it rests on little evidence.",
  },
  {
    term: "Domain",
    definition:
      "The area of the stack a function sits in — blockchain core and physical storage, coordination and hardening, storage market middleware, UX/DX.",
  },
  {
    term: "Single maintainer",
    definition:
      "A function with exactly one team reporting on it. Tolerable at the lower tiers, a named risk at the top two, where the posture calls for **two or more independent implementations** — if that team stops, nothing else provides the function.",
  },
];
