/**
 * Kernel program page.
 *
 * Every figure here is transcribed from the published design. Nothing is read
 * live yet — replace the exports in this module with API reads when the Kernel
 * metrics endpoints exist. Component code reads only these types, so the swap
 * does not touch the page.
 */

export type TierId = "irreplaceable" | "essential" | "important" | "nice";

export type Tier = {
  id: TierId;
  name: string;
  /** One-line rule that decides whether a function belongs in this tier. */
  rule: string;
  detail: string;
  example: string;
  posture: string;
  /** Short posture phrasing used in the overview table. */
  posturePosture: string;
  /** Declared function count, or null when the tier is not inventoried yet. */
  functions: number | null;
  /** How many of those functions are listed on this page. */
  listed: number | null;
  /** Rolling-90d SLA across measured functions, or null when unmeasured. */
  slaMet: string | null;
  measured: number | null;
};

export const TIERS: Tier[] = [
  {
    id: "irreplaceable",
    name: "Irreplaceable",
    rule: "Only provider. Network halts without it. No substitute exists.",
    detail:
      "Ledger, resource, and programmability — what the blockchain and the physical-storage-backed ledger need in order to keep running at all.",
    example:
      "Distributed randomness beacon — without it, block production stops.",
    posture:
      "Must fund. Non-negotiable security requirements. Audits milestone-gated.",
    posturePosture: "Must fund — non-negotiable",
    functions: 5,
    listed: 5,
    slaMet: "97.3%",
    measured: 4,
  },
  {
    id: "essential",
    name: "Essential",
    rule: "Network-critical, but alternatives exist. We need at least one.",
    detail:
      "Core offerings — disk space from miners, storage primitives in smart contracts — that let participants engage with the irreplaceable components.",
    example:
      "Testnets: the network continues without them, but at least one is needed to stage and rehearse upgrades.",
    posture:
      "Fund for diversity that ensures uptime — maintain two or more implementations. Budget negotiable.",
    posturePosture: "Fund for redundancy — 2+ implementations",
    functions: 24,
    listed: 17,
    slaMet: "96.5%",
    measured: 15,
  },
  {
    id: "important",
    name: "Important",
    rule: "Load-bearing. Multiple dependents. Silent failure cascades.",
    detail:
      "Supports and improves access to the critical components, and speeds up development of revenue-generating work.",
    example:
      "A testnet faucet: it makes test FIL easy to get, but the network runs without it.",
    posture:
      "Fund maintenance, not features. Flag any repo with zero active developers.",
    posturePosture: "Fund maintenance, not features",
    functions: null,
    listed: null,
    slaMet: null,
    measured: null,
  },
  {
    id: "nice",
    name: "Nice to have",
    rule: "Enriches the ecosystem. Network survives without it.",
    detail:
      "Initiatives that encourage additional growth, where having even one instance may matter for basic ecosystem support.",
    example:
      "F3: the network exists without it, but it improves UX considerably and encourages growth.",
    posture:
      "Discretionary. Fund only where aligned with the sustainability strategy.",
    posturePosture: "Discretionary",
    functions: null,
    listed: null,
    slaMet: null,
    measured: null,
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
  { date: "Aug 2026", label: "Health reporting continuous", state: "current" },
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
  ctaText: "Get notified",
  ctaHref: "https://app.filpgf.io/programs/1479/",
};

/** The domains a function can sit in, in the order the inventory presents them. */
export const DOMAINS = [
  "Blockchain core & physical storage",
  "Coordination & incentives",
  "UX / DX",
] as const;

export type Domain = (typeof DOMAINS)[number];

export type FunctionRow = {
  tier: TierId;
  /** Sub-label shown after the tier in the row's kicker, e.g. "Networking". */
  category: string;
  domain: Domain;
  name: string;
  /** Rolling-90d figure, or null when the function reports no health metric. */
  slaMet: string | null;
  singleMaintainer?: boolean;
  noMaintainer?: boolean;
  noHealthMetric?: boolean;
  /** Free-text tail shown after the flags, e.g. growth-counter notes. */
  note?: string;
};

/**
 * Verified rows transcribed from the design. The Essential tier declares 24
 * functions and the design lists 17 of them; the crops we have legibly show 14,
 * and 4 of the 5 Irreplaceable rows. Missing rows are deliberately absent
 * rather than invented — add them from the source inventory before launch.
 */
export const FUNCTIONS: FunctionRow[] = [
  {
    tier: "irreplaceable",
    category: "Networking",
    domain: "Blockchain core & physical storage",
    name: "GossipSub propagation, Kademlia DHT peer/content discovery, transports (TCP/QUIC) + NAT traversal",
    slaMet: "95.7%",
    singleMaintainer: true,
  },
  {
    tier: "irreplaceable",
    category: "Proving",
    domain: "Blockchain core & physical storage",
    name: "Proving subsystem — PoRep (StackedDRG sealing), WinningPoSt/WindowPoSt, crypto primitives (BLST, bellperson, neptune)",
    slaMet: "100.0%",
    singleMaintainer: true,
  },
  {
    tier: "irreplaceable",
    category: "Randomness",
    domain: "Blockchain core & physical storage",
    name: "Distributed randomness beacon (threshold-BLS, League of Entropy)",
    slaMet: "93.3%",
    singleMaintainer: true,
  },
  {
    tier: "irreplaceable",
    category: "VM & programmability",
    domain: "Blockchain core & physical storage",
    name: "FVM execution engine (deterministic WASM actor execution)",
    slaMet: null,
    noMaintainer: true,
    noHealthMetric: true,
  },

  {
    tier: "essential",
    category: "Ledger & consensus",
    domain: "Blockchain core & physical storage",
    name: "Chain sync & state management (snapshot bootstrap, heaviest-chain, RPC)",
    slaMet: "97.2%",
  },
  {
    tier: "essential",
    category: "Block production (mining)",
    domain: "Blockchain core & physical storage",
    name: "Block production — WinningPoSt leader election & block assembly",
    slaMet: "93.3%",
    singleMaintainer: true,
  },
  {
    tier: "essential",
    category: "Block production (mining)",
    domain: "Blockchain core & physical storage",
    name: "Sealing pipeline (PC1/PC2/Commit, SupraSeal, Snap)",
    slaMet: "88.0%",
  },
  {
    tier: "essential",
    category: "Block production (mining)",
    domain: "Blockchain core & physical storage",
    name: "Block production — WindowPoSt + WinningPoSt scheduler",
    slaMet: "95.6%",
    singleMaintainer: true,
  },
  {
    tier: "essential",
    category: "Block production (mining)",
    domain: "Blockchain core & physical storage",
    name: "Pooled block production (sophon-miner) + distributed sealing cluster (Damocles)",
    slaMet: "83.3%",
    singleMaintainer: true,
  },
  {
    tier: "essential",
    category: "Block production (mining)",
    domain: "Blockchain core & physical storage",
    name: "Deal-making + PDP + HTTP retrieval",
    slaMet: null,
    singleMaintainer: true,
    noHealthMetric: true,
    note: "2 growth counters on the project view",
  },
  {
    tier: "essential",
    category: "Network data & monitoring",
    domain: "Blockchain core & physical storage",
    name: "Monitoring, archival access and incident response (Grafana, OpsGenie, IR coordination)",
    slaMet: "100.0%",
    singleMaintainer: true,
  },
  {
    tier: "essential",
    category: "Shared infra stewardship",
    domain: "Blockchain core & physical storage",
    name: "Vendor/access governance, runbooks, Slack/Workspace/GitHub stewardship",
    slaMet: "100.0%",
    singleMaintainer: true,
  },
  {
    tier: "essential",
    category: "Testnets",
    domain: "Blockchain core & physical storage",
    name: "Mainnet-realistic testnet for rehearsing every network-version upgrade",
    slaMet: "100.0%",
    singleMaintainer: true,
  },
  {
    tier: "essential",
    category: "Testnets — explorer",
    domain: "Blockchain core & physical storage",
    name: "Explorer for Calibration testnet",
    slaMet: "96.7%",
    singleMaintainer: true,
  },
  {
    tier: "essential",
    category: "Testnets — miners",
    domain: "Blockchain core & physical storage",
    name: "Calibnet miners (Lotus-Miner / Curio / Venus) for upgrade rehearsal",
    slaMet: "97.1%",
  },
  {
    tier: "essential",
    category: "Network data & monitoring",
    domain: "Coordination & incentives",
    name: "Aggregates Filecoin on/off-chain data into open, queryable datasets and dashboards",
    slaMet: "97.4%",
  },
  {
    tier: "essential",
    category: "Explorers and tooling",
    domain: "UX / DX",
    name: "Mainnet block explorer (Lotus archive, indexing, NV maintenance)",
    slaMet: "100.0%",
    singleMaintainer: true,
  },
  {
    tier: "essential",
    category: "Explorers and tooling",
    domain: "UX / DX",
    name: "Network-wide documentation along with source code availability and source control",
    slaMet: "100.0%",
    singleMaintainer: true,
  },
];

export type KernelMetric = {
  value: string;
  label: string;
  note: string;
  /** Renders the note in the warning colour when the number is a risk. */
  noteTone?: "muted" | "warn";
};

export const KERNEL_METRICS: KernelMetric[] = [
  {
    value: "$2.99M",
    label: "Committed across funded functions",
    note: "20 of 22 listed · term ends Dec",
  },
  {
    value: "96.6%",
    label: "Health met across measured functions",
    note: "Rolling 90 days · 19 of 22 listed",
  },
  {
    value: "86%",
    label: "Measurement coverage",
    note: "3 listed functions report no health metric",
    noteTone: "warn",
  },
  {
    value: "16",
    label: "Irreplaceable or Essential functions with one maintaining team",
    note: "Posture calls for 2+ implementations",
    noteTone: "warn",
  },
  {
    value: "19",
    label: "Teams reporting",
    note: "Across 29 declared functions",
  },
];

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
      "A measurable indicator with an agreed target, reported by the maintaining team. Functions without one cannot be assessed and are marked **not measured**.",
  },
  {
    term: "SLA met · 90d",
    definition:
      "The share of the last 90 days a function's health metrics stayed within target. A rolling window, so it reflects current condition rather than a single check.",
  },
  {
    term: "Domain",
    definition:
      "The area of the stack a function sits in — blockchain core and physical storage, coordination and hardening, storage market middleware, UX/DX.",
  },
  {
    term: "Single maintainer",
    definition:
      "A function maintained by exactly one team. Tolerable at lower tiers, a named risk at the top two, where the posture calls for two or more independent implementations.",
  },
];
