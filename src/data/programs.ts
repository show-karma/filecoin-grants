import { EXTERNAL } from "./site";

/** Revenue Development ------------------------------------------------ */

export const REVDEV_ROADMAP_CRITERIA = [
  "A named network-level KPI the six months are meant to move",
  "A path to paying customers with real names, not pilots",
  "Work only this pod is positioned to do",
];

export type Pod = {
  name: string;
  kicker: string;
  description: string;
  owns: string[];
  linkText: string;
  href: string;
};

export const PODS: Pod[] = [
  {
    name: "Filecoin Onchain Cloud",
    kicker: "Developer platform",
    description:
      "Filecoin's developer-facing storage platform: warm storage, verifiable retrieval, and proof-gated payments, plus the SDK surface teams build against. Also carries demand from builders at the intersection of AI, DePIN, and Web3.",
    owns: [
      "The developer platform and integration layer",
      "Payment rails and proof-gated settlement",
      "Onboarding for Web3 and AI builders",
    ],
    linkText: "filecoin.cloud",
    href: EXTERNAL.filecoinCloud,
  },
  {
    name: "Fil One",
    kicker: "Enterprise object storage",
    description:
      "Enterprise sales into traditional storage buyers: S3-compatible object storage on Filecoin, aimed at the petabyte-scale workloads that move on price, durability, and compliance. Also carries large dataset onboarding.",
    owns: [
      "Enterprise sales and the provider quality bar",
      "S3 compatibility and migration onramps",
      "Large dataset onboarding",
    ],
    linkText: "fil.one",
    href: EXTERNAL.filOne,
  },
];

export const PODS_FOOTNOTE =
  "Consolidated from three pods to two in 2026, concentrating effort on the network's two demand surfaces. Work that no single pod should own on its own is what this program funds.";

export type FundingFact = { label: string; value: string; note: string };

export const REVDEV_FUNDING_FACTS: FundingFact[] = [
  {
    label: "Recipients",
    value: "2 pods",
    note: "No open call, no public application",
  },
  { label: "Horizon", value: "6 months", note: "Re-scoped each cycle" },
  {
    label: "Payouts",
    value: "Milestone-gated",
    note: "Released as delivery is verified",
  },
  {
    label: "Reporting",
    value: "Bi-weekly",
    note: "Plus a monthly pod roll-up",
  },
];

export type ProcessStep = { title: string; detail: string };

export const REVDEV_PROCESS: ProcessStep[] = [
  {
    title: "Pod scopes the roadmap",
    detail: "Six months of work against a named KPI",
  },
  {
    title: "Review and allocation",
    detail: "Assessed against the 2026 network objectives",
  },
  {
    title: "Milestones land",
    detail: "Payouts released as delivery is verified",
  },
  { title: "Published progress", detail: "Bi-weekly reports, monthly roll-up" },
  { title: "Re-scope", detail: "Next roadmap set against results" },
];

/** R&D ----------------------------------------------------------------- */

export const RND_LOOKING_FOR = [
  "Work that closes a named gap in the network",
  "Where relevant, the Kernel function or Revenue Development roadmap it would strengthen",
  "Work that sits alongside the pods, supporting them without duplicating what they own",
  "A second implementation where the network currently depends on just one",
  "Findings the ecosystem can use even if the work itself does not continue",
  "A credible route from this stage into ongoing Kernel or Revenue Development funding",
];

export const RND_NOT_IN_SCOPE = [
  "Open-ended research with no gap named",
  "Work with no credible path to shipping inside the grant horizon",
  "Marketing campaigns, business development, acquisitions, and one-off incentives",
  "Work that duplicates what a pod or an existing Kernel function already covers",
];

export const RND_OPEN_RFPS = {
  eyebrow: "Coming soon",
  title: "The first R&D RFPs are being drafted now.",
  description:
    "Each one will name a specific gap, say which program the work is meant to serve, and stay open until it's filled or withdrawn. They'll be published here and on the blog as they're ready.",
  linkText: "Follow the blog for the announcement",
  href: "/blog/",
};
