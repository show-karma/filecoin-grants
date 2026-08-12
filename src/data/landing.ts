import { EXTERNAL, reportUrl } from "./site";

/**
 * Figures shown on the landing page. These are published numbers, not live
 * reads — swap this module for an API call when the metrics endpoints exist.
 */
export const LAST_UPDATED = "07 Jun 2026";

export type Stat = {
  value: string;
  label: string;
  linkText: string;
  href: string;
};

export const HEADLINE_STATS: Stat[] = [
  {
    value: "$6.9M",
    label: "Deployed to date",
    linkText: "Funded Projects",
    href: EXTERNAL.explorer,
  },
  {
    value: "31",
    label: "Active Projects",
    linkText: "Funding Reports",
    href: EXTERNAL.reports,
  },
  {
    value: "3",
    label: "Funding Initiatives",
    linkText: "Kernel · Revenue Dev · R&D",
    href: "#objectives",
  },
  {
    value: "86%",
    label: "Checkpoints cleared across active projects",
    linkText: "Bi-weekly progress report",
    href: reportUrl("biweeklyProgress"),
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
  href: string;
};

export const REPORT_CADENCES: ReportCadence[] = [
  {
    cadence: "Every two weeks",
    title: "Progress reporting",
    description:
      "Granular tracking from every funded team — what shipped, what moved, what's blocked.",
    linkText: "Latest: 04 Aug 2026",
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
    linkText: "View the metrics",
    href: EXTERNAL.financials,
  },
];
