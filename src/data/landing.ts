import {
  EXTERNAL,
  reportUrl,
  programReportUrl,
  PROGRAM_REPORTS_URL,
  PROGRAM_PROJECTS_URL,
} from "./site";
import {
  FALLBACK_COUNTS,
  FALLBACK_METRICS,
  trackFor,
  type CommunityMetrics,
  type LiveCounts,
} from "../lib/karma";

/**
 * Figures shown on the landing page. Where the community metrics endpoint can
 * supply a figure, the committed constants below are the fallback rather than
 * the source; where it cannot, they are the source. Each stat says which.
 */

export type Stat = {
  value: string;
  label: string;
  linkText: string;
  href: string;
};

/**
 * Money contracted out, by round. Supplied by the programme team on
 * 14 Aug 2026 — these supersede the figures on the app's Commitments &
 * Disbursements tab (/financials), which lag behind recently signed contracts
 * and cancelled milestones.
 *
 * This is what is **committed**, not what has been paid out. Two rounds carry
 * caveats from the team:
 * - Batch 1 is below its original award because some milestones were cancelled
 *   over performance and shifting priorities.
 * - Batch 3 exceeds its $2M hard commitment pool because some contracts carry
 *   soft commitments that fall into the next round.
 *
 * For reference, that tab last read $4,992,936 disbursed against these
 * commitments. It cannot be fetched at build time —
 * /v2/communities/:slug/payouts requires a JWT.
 */
export const FINANCIALS = {
  updated: "14 Aug 2026",
  rounds: [
    { name: "ProPGF Batch 1", committed: 3_371_800 },
    { name: "ProPGF Batch 2", committed: 3_171_198 },
    { name: "Pods Round 1", committed: 880_973.81 },
    { name: "ProPGF Batch 3", committed: 2_419_266 },
    // Two separate commitments inside the same round.
    { name: "Pods Round 2", committed: 156_870 + 82_474.19 },
  ],
};

/** Total contracted out — $10,082,582 at the last refresh. */
export const totalCommitted = (): number =>
  FINANCIALS.rounds.reduce((total, round) => total + round.committed, 0);

/** Compact display form, e.g. 10082582 -> "$10.08M". */
export const asMillions = (value: number): string =>
  `$${(value / 1_000_000).toFixed(2)}M`;

/**
 * Portfolio completion, following the Bi-Weekly Check-In Report's own
 * methodology: each track's figure is the mean completion across its funded
 * projects, so the portfolio figure is that mean weighted by project count.
 *
 * The percentages are the report's published numbers rather than a
 * recalculation — its aggregation is not reproducible from the public GAP API,
 * and /v2/communities/:slug/reports needs a JWT, so it cannot be read at build
 * time. Refresh `completion` and `reportDate` when a new report publishes.
 *
 * Finished rounds are carried at 100 regardless of what the report shows for
 * them: Batch 1 closed in August 2025 and is absent from the report entirely,
 * and the Pods Track is complete though the report still prints 92%.
 */
export const PORTFOLIO = {
  reportDate: "13 Aug 2026",
  tracks: [
    { name: "ProPGF Batch 1", grants: 14, completion: 100, finished: true },
    { name: "ProPGF Batch 2", grants: 16, completion: 62, finished: false },
    { name: "ProPGF Batch 3", grants: 19, completion: 1, finished: false },
    { name: "Pods Track", grants: 3, completion: 100, finished: true },
  ],
};

/**
 * Weighted by each track's funded-grant count, then truncated — never rounded
 * up, so the figure cannot claim more progress than has been cleared.
 *
 * The weights sum to 52, not the 48 distinct projects on the site: four
 * projects hold grants in both Batch 2 and Batch 3, each with its own
 * milestones, so they contribute to both tracks' means. This matches how the
 * report frames it — it counts 16 and 19 funded projects across those two
 * tracks, with the same overlap.
 */
export const portfolioCompletion = (): number => {
  const grants = PORTFOLIO.tracks.reduce((n, t) => n + t.grants, 0);
  const weighted = PORTFOLIO.tracks.reduce(
    (n, t) => n + t.grants * t.completion,
    0,
  );
  return grants ? Math.trunc(weighted / grants) : 0;
};

/**
 * "Committed to date" is the API's `funding.totals.allocated`, falling back to
 * the hand-kept FINANCIALS sum when the endpoint has no funding block (which is
 * still the case on production).
 *
 * The two disagree, and materially: FINANCIALS totals $10,082,582 against the
 * API's $8,642,697. They differ on every round — Batch 1 +$370k, Batch 2
 * -$1.05M, Pods Round 1 -$267k, Batch 3 -$251k — and "Pods Round 2" ($239,344)
 * is absent from the API altogether, which looks like missing grant data
 * upstream rather than a definitional difference. The programme team chose the
 * API's figure knowingly, so the page now states one source rather than mixing
 * two. FINANCIALS stays as the fallback and as the record of the discrepancy.
 */
const committedToDate = (metrics: CommunityMetrics): number =>
  metrics.allocated ?? totalCommitted();

/**
 * The API's mean supersedes the hand-maintained PORTFOLIO table, which changes
 * the methodology: PORTFOLIO carries finished rounds at 100 where the API
 * computes what it measures (95.1 for Batch 1). The displayed figure barely
 * moves — 52% either way — but it is now reproducible and refreshes itself,
 * instead of needing a hand edit every time a bi-weekly report publishes.
 * PORTFOLIO stays as the fallback path.
 *
 * Truncated, as portfolioCompletion() is, so the page can never round up into
 * claiming more progress than was actually cleared. A mean under 1% truncates
 * to a bare "0%", which reads as a stalled portfolio rather than as an early
 * round, so that drops to the report's figure as well.
 */
const checkpointsCleared = (metrics: CommunityMetrics): number => {
  const live =
    metrics.avgMilestoneCompletion === null
      ? 0
      : Math.trunc(metrics.avgMilestoneCompletion);
  return live > 0 ? live : portfolioCompletion();
};

/**
 * The headline stats. Three are read from the Karma GAP API at build time (see
 * src/lib/karma.ts) and fall back per figure — a missing `funding` block, which
 * is what production currently serves, only costs the live reads, never the
 * page. The fourth is editorial.
 */
export const buildHeadlineStats = (
  counts: LiveCounts,
  metrics: CommunityMetrics = FALLBACK_METRICS,
): Stat[] => [
  {
    value: asMillions(committedToDate(metrics)),
    label: "Committed to date",
    linkText: "Funded Projects",
    href: PROGRAM_PROJECTS_URL,
  },
  {
    // A zero count would mean the grants read came back empty rather than that
    // nothing is funded, so it drops to the committed figure too.
    value: String(
      metrics.distinctProjects ??
        (counts.projects > 0 ? counts.projects : FALLBACK_COUNTS.projects),
    ),
    label: "Total Projects",
    linkText: "Funding Reports",
    href: PROGRAM_REPORTS_URL,
  },
  {
    // Editorial, not an API figure: the three programmes the site is organised
    // around. It changes when the programme structure changes, not on a build.
    value: "3",
    label: "Funding Initiatives",
    linkText: "Kernel · Revenue Dev · R&D",
    href: "#objectives",
  },
  {
    value: `${checkpointsCleared(metrics)}%`,
    label: "Checkpoints cleared across active projects",
    linkText: "Bi-weekly progress report",
    href: programReportUrl("biweeklyProgress"),
  },
];

/**
 * A run of text where some spans link out — used for the "Pods" row, which
 * names Filecoin Onchain Cloud and Fil One as links inside a sentence.
 */
export type TextSegment = { text: string; href?: string };

export type Objective = {
  index: string;
  title: string;
  description: string;
  program: string;
  programQualifier: string;
  href: string;
  model: string;
  measured: string;
  pods?: TextSegment[];
  initiatives: number;
  amount: string;
};

export const OBJECTIVES: Objective[] = [
  {
    index: "01",
    title: "Keep the network running",
    description:
      "Implementations, randomness, critical libraries, and the essential services the rest of the ecosystem builds on top of stay maintained and accountable — no quiet decay in the dependencies everything assumes.",
    program: "Kernel",
    programQualifier: "near-fixed cost",
    href: "/kernel/",
    model: "Yearly grants with regular audits",
    measured:
      "Agreed metrics for core network resilience and operational continuity",
    initiatives: 10,
    amount: "$2.3M",
  },
  {
    index: "02",
    title: "Turn capacity into paid usage",
    description:
      "Convert real storage demand into paid, onchain services — the adoption drivers, onramps, and developer surfaces that move the network from proven capacity to revenue.",
    program: "Revenue Development",
    programQualifier: "high-ROI",
    href: "/revenue-development/",
    model: "Milestone-gated, six-month roadmaps scoped via Pods",
    measured: "Network-level KPIs and contribution to ecosystem growth",
    pods: [
      { text: "Filecoin Onchain Cloud", href: EXTERNAL.filecoinCloud },
      { text: " and " },
      { text: "Fil One", href: EXTERNAL.filOne },
      { text: " — this program funds both, and nothing else" },
    ],
    initiatives: 14,
    amount: "$3.2M",
  },
  {
    index: "03",
    title: "Make sure there's a next",
    description:
      "Exploratory work funded in stages, so promising directions can be backed early. What proves out becomes Kernel infrastructure or Revenue Development work.",
    program: "R&D",
    programQualifier: "optionality",
    href: "/rnd/",
    model: "RFPs with rolling review, funded as staged bets",
    measured:
      "What matures into, or integrates with, Kernel and Revenue Development work",
    initiatives: 7,
    amount: "$1.4M",
  },
];

/**
 * Whether `funding.byTrack` may drive the objective card footers.
 *
 * False, because the mapping upstream looks wrong rather than the page:
 * - byTrack's allocations sum to $9,966,741 against a `totals.allocated` of
 *   $8,642,697 — over by $1,324,044. Live footers would therefore add up to
 *   more than the "Committed to date" tile sitting on the same page, which any
 *   reader can check.
 * - Revenue Development returns exactly $880,974 / 3 projects / 100% — the old
 *   "Pods Round 1" figure, i.e. the "ProPGF Batch 2 - Pods Track" programme
 *   alone. The track appears to miss every later Pods commitment.
 * - R&D returns $7,273,500 / 34 projects, which reads as a catch-all absorbing
 *   Batches 1–3, against a programme this page describes as small staged bets.
 * - `funding.programs[]` carries no track field, so none of that mapping can be
 *   checked from the payload; it has to be fixed at the source.
 *
 * `tracksReconcile()` in src/lib/karma.ts is the machine-checkable half of this,
 * and a test pins it.
 *
 * The programme team was shown all of the above and chose to publish the API's
 * figures regardless, so this is on: the footers are the endpoint's numbers,
 * overshoot and all. Set it back to false to fall through to the static
 * figures — the fallback path below is still real code and still tested.
 */
const TRACK_FIGURES_ARE_AUTHORITATIVE: boolean = true;

/**
 * Count and noun stay apart so the card can weight them differently, and so the
 * pluralisation rule lives here rather than in a template.
 *
 * Matched on the objective's `program`, since `trackId` has no map here.
 */
export const objectiveInitiatives = (
  objective: Objective,
  metrics: CommunityMetrics,
): { count: number; noun: string } => {
  const live = trackFor(metrics, objective.program)?.projects ?? null;
  const count =
    TRACK_FIGURES_ARE_AUTHORITATIVE && live !== null
      ? live
      : objective.initiatives;
  return { count, noun: count === 1 ? "initiative" : "initiatives" };
};

/**
 * Millions once there are millions, thousands below that: a track holding
 * $880,974 reads as "$881k", not "$0.88M", which puts a leading zero on the
 * card and makes a real award look like a rounding error next to its
 * neighbours.
 */
const trackAmount = (amount: number): string =>
  amount >= 1_000_000 ? asMillions(amount) : `$${Math.round(amount / 1_000)}k`;

export const objectiveAmount = (
  objective: Objective,
  metrics: CommunityMetrics,
): string => {
  const live = trackFor(metrics, objective.program)?.allocated ?? null;
  return TRACK_FIGURES_ARE_AUTHORITATIVE && live !== null
    ? trackAmount(live)
    : objective.amount;
};

export type ObjectiveCard = {
  objective: Objective;
  /** Ready to render: `{ count: 13, noun: "initiatives" }`, "$1.81M". */
  initiatives: { count: number; noun: string };
  amount: string;
};

/**
 * Everything else on these cards — title, description, model, measured, pods,
 * qualifier — is editorial copy and stays static; only the two footer figures
 * have an API counterpart at all.
 */
export const buildObjectiveCards = (
  metrics: CommunityMetrics = FALLBACK_METRICS,
): ObjectiveCard[] =>
  OBJECTIVES.map((objective) => ({
    objective,
    initiatives: objectiveInitiatives(objective, metrics),
    amount: objectiveAmount(objective, metrics),
  }));

export type ReportCadence = {
  cadence: string;
  title: string;
  description: string;
  linkText: string;
  /** Omitted while a report has no destination yet — renders as plain text. */
  href?: string;
};

export const REPORT_CADENCES: ReportCadence[] = [
  {
    cadence: "Every two weeks",
    title: "Progress reporting",
    description:
      "Granular tracking from every funded team — what shipped, what moved, what's blocked.",
    linkText: `Latest: ${PORTFOLIO.reportDate}`,
    href: reportUrl("biweeklyProgress"),
  },
  {
    cadence: "Monthly",
    title: "Pods reporting",
    description:
      "Each pod against its six-month roadmap, including the network-level KPIs it's accountable for.",
    linkText: "Latest: July 2026",
    href: reportUrl("monthlyPods"),
  },
  {
    cadence: "Continuous",
    title: "Health & impact metrics",
    description:
      "The network-level numbers each program is judged against — resilience, paid usage, and what research has graduated.",
    linkText: "Coming soon",
  },
];
