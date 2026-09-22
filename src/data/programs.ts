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
      "Large-scale data onboarding, storage provider coordination, and retrieval markets",
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
  title: "R&D RFPs Opening Soon",
  description:
    "Focus areas listed below will regularly be updated to ensure the focus areas remain targeted to ecosystem priorities. Will be accepting applications soon!",
};

export type FocusArea = {
  title: string;
  /** A condition every proposal in the area must meet, shown under the title. */
  note?: string;
  inScope: string[];
  notInScope: string[];
};

export const RND_FOCUS_AREAS: FocusArea[] = [
  {
    title: "Customer-facing products built on Filecoin",
    inScope: [
      "Products for AI workloads, such as agent memory, tamper-evident audit logs, and training-data provenance",
      "Products for creative, media, and archival data storage, for studios and cultural institutions",
      "Products for compliance and regulated data, with write-once retention and audit trails",
      "Products for real-world-asset and onchain-data teams with near-to-medium term potential to convert to ARR",
    ],
    notInScope: [
      "Platform extensions (SDKs, adapters, gateways)",
      "Unvalidated MVPs or demos",
      "Acquisitions, channel business development, and marketing",
      "Research-only projects",
    ],
  },
  {
    title: "Storage provider economics and growth",
    inScope: [
      "Recruitment programs targeting adjacent differentiated supply, such as colocation operators and regional cloud providers",
      "Retention infrastructure for the existing provider base",
      "Rigorous economic modeling for storage providers, published as an ongoing public resource",
      "Financial products that reduce capital risk, such as equipment financing and revenue-sharing arrangements",
    ],
    notInScope: [
      "New mining-hardware ventures",
      "Marketing campaigns without economic modeling",
      "One-off incentive programs",
    ],
  },
  {
    title: "AI infrastructure products on Filecoin",
    inScope: [
      "Verifiable-compute and audit services: productized services pairing Filecoin storage with verifiable execution",
      "Training-data provenance products: commercial offerings that solve audit and licensing-provenance problems",
      "Cross-stack verifiable-AI infrastructure, with owned products and customers",
      "Machine-readable ecosystem knowledge: services that create and maintain technical documentation",
    ],
    notInScope: [
      "General-purpose AI products that use Filecoin incidentally",
      "Research-only projects",
      "Open-source contributions without customer-facing products",
    ],
  },
  {
    title: "FIL value accrual: burn and lock mechanisms",
    note: "Proposals must include a credible path to mainnet within the grant horizon.",
    inScope: [
      "Fee-and-burn mechanisms on stablecoin payment rails, routing payments through swap-to-FIL-and-burn",
      "Protocol-level fee burns tied to network activity",
      "FIL-locking primitives for storage providers and customers, through staking, escrow, or collateral",
      "FIL-locking primitives for ecosystem participants, with lock-and-earn mechanisms",
      "Measurement, dashboards, and verification for burn rates and locked supply",
    ],
    notInScope: [
      "Research papers without implementation plans",
      "Mechanisms without mainnet viability",
      "Speculative tokenomics requiring broad consensus changes",
      "One-off \u201cbuy and burn\u201d marketing",
      "Designs dependent on a single counterparty",
    ],
  },
];

export const RND_EVALUATION: { label: string; value: string }[] = [
  {
    label: "Process",
    value:
      "Three phases: AI-assisted shortlist, committee vetting, final allocation",
  },
  { label: "Assessed", value: "Against Filecoin's 2026 network objectives" },
  { label: "Strongest", value: "Shipped products with named paying customers within six months" },
];
