import {
  EXTERNAL,
  reportUrl,
  programReportUrl,
  PROGRAM_REPORTS_URL,
  PROGRAM_PROJECTS_URL,
} from "./site";
import type { LiveCounts } from "../lib/karma";

/**
 * Figures shown on the landing page. These are placeholder numbers, not live
 * reads — swap this module for an API call once the metrics endpoints exist.
 */

export type Stat = {
  value: string;
  label: string;
  linkText: string;
  href: string;
};

/**
 * Grant funding, read off the Financials tab on app.filpgf.io (Total grant and
 * Disbursed columns, summed across all 52 grants).
 *
 * Transcribed rather than fetched: /v2/communities/:slug/payouts requires a
 * JWT, so this cannot be read at build time. Refresh when the financials move.
 *
 * Caveats worth keeping in view when updating:
 * - One Batch 3 grant (Curio) has no amount recorded, so `granted` is a floor.
 * - One Pods Track row reports more disbursed than granted ($467k vs $466k).
 */
export const FINANCIALS = {
  programmes: [
    {
      name: "ProPGF Batch 1",
      grants: 14,
      granted: 3_741_800,
      disbursed: 3_263_600,
    },
    {
      name: "ProPGF Batch 2",
      grants: 16,
      granted: 3_175_700,
      disbursed: 1_165_999,
    },
    { name: "ProPGF Batch 3", grants: 19, granted: 2_168_267, disbursed: 0 },
    { name: "Pods Track", grants: 3, granted: 880_974, disbursed: 563_337 },
  ],
};

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
 * The headline stats. Two are read from the Karma GAP API at build time
 * (see src/lib/karma.ts); the other two are still placeholders — see below.
 */
export const buildHeadlineStats = (counts: LiveCounts): Stat[] => [
  {
    // Supplied by the programme team. For reference when refreshing, the
    // Financials tab sums to $9,966,741 granted against $4,992,936 disbursed
    // (see FINANCIALS above for the split).
    value: "$9.76M",
    label: "Deployed to date",
    linkText: "Funded Projects",
    href: PROGRAM_PROJECTS_URL,
  },
  {
    value: String(counts.projects),
    label: "Total Projects",
    linkText: "Funding Reports",
    href: PROGRAM_REPORTS_URL,
  },
  {
    value: "3",
    label: "Funding Initiatives",
    linkText: "Kernel · Revenue Dev · R&D",
    href: "#objectives",
  },
  {
    value: `${portfolioCompletion()}%`,
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
