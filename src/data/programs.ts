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

export type Rfp = {
  title: string;
  objective: string;
  problem: string;
  inScope: string[];
  notInScope: string[];
  whoShouldApply: string;
};

export const RND_RFPS: Rfp[] = [
  {
    title: "Filecoin Paid Retrieval Prototype",
    objective:
      "Produce a design recommendation and a working proof-of-concept that lets providers get paid for services, so e.g. retrieval becomes a revenue line alongside storage.",
    problem:
      "Storage providers earn on storage, but serving data back is virtually always unpaid. That weakens the incentive to retrieve fast and reliably, and it is a gap in the network\u2019s long-term economics. Several designs have been proposed over the years across Filecoin, IPFS and libp2p, but no functional prototype exists today.",
    inScope: [
      "A survey of prior art: past Filecoin retrieval-market designs, payment-channel approaches and any live paid-retrieval services",
      "A comparison of protocol-level versus application-level approaches, with trade-offs on latency, trust, cost per request and SP integration effort",
      "A prototype of one recommended approach. Suggested starting point: a voucher system using MPP for Filecoin Onchain Cloud (FOC) paid retrieval",
      "An end-to-end demo: client pays, SP serves, SP settles",
    ],
    notInScope: [
      "Production deployment or mainnet launch",
      "Changes to Filecoin consensus or FIPs (a FIP draft can be a recommendation, not a deliverable)",
      "Building a new client or gateway beyond what the demo needs",
    ],
    whoShouldApply:
      "Teams with hands-on experience in Filecoin retrieval, payment channels or micropayments, and libp2p. Prior published research is a plus.",
  },
  {
    title: "Complementary Security Testing of Filecoin EVM Deployments",
    objective:
      "Add an independent layer of security testing for high-value FEVM contracts, complementing (not duplicating) FF Security\u2019s existing test harnesses.",
    problem:
      "Filecoin Solstice and USDFC hold real user value on FEVM, and Filecoin Pay contracts are becoming core infrastructure for Filecoin Onchain Cloud. FF Security already runs test harnesses for Solstice and USDFC, but one team\u2019s view leaves blind spots. FEVM also differs from Ethereum (actor model, gas, precompiles), so standard EVM tooling can miss Filecoin-specific issues.",
    inScope: [
      "Review of FF Security\u2019s current harnesses to identify coverage gaps",
      "New tests in the gaps: invariant/property-based fuzzing (Foundry, Echidna, Medusa), formal or symbolic checks on critical paths, and FEVM-specific edge cases",
      "Targets: Solstice, USDFC, and Filecoin Pay contracts (v1, and v2 if stable)",
      "Responsible disclosure of any findings before public reporting",
    ],
    notInScope: [
      "A full traditional audit of each codebase from scratch",
      "Fixing the contracts (findings go to maintainers)",
      "Off-chain infrastructure and front ends",
    ],
    whoShouldApply:
      "Smart-contract security teams or independent researchers with public audit or fuzzing work, ideally with experience in stablecoin/CDP systems (Liquity-style troves) and payment-rail contracts. FEVM experience is a strong plus.",
  },
  {
    title: "Programmable PoRep Proving Pipeline via FEVM",
    objective:
      "Expose Filecoin\u2019s existing PoRep, PoSt and related proof verifiers to FEVM so that a Solidity contract can run a full PoRep / PoSt / prove-update cycle, enabling a PoRep+PDP-style system built entirely in FEVM.",
    problem:
      "Today, Filecoin\u2019s sealing proofs (PoRep, Window/WinningPoSt, ProveReplicaUpdates) can only be verified by built-in actors. Builders can use PDP from Solidity, but cannot plug into the stronger PoRep guarantees. The verifier logic already exists in the VM; it just isn\u2019t reachable from FEVM. Exposing it would let anyone build custom storage markets and proof systems as smart contracts.",
    inScope: [
      "Identifying the exact set of existing VM verification methods required",
      "Exposing them to FEVM (e.g. as precompiles or callable actor methods) with no new cryptography or proof code",
      "A reference Solidity contract that completes a full PoRep \u2192 PoSt \u2192 prove-update cycle on a devnet/calibnet",
      "Gas benchmarks for each exposed call",
    ],
    notInScope: [
      "New proof systems or changes to proof parameters",
      "A production storage market built on top (that can be a follow-on RFP)",
    ],
    whoShouldApply:
      "Engineers familiar with ref-fvm, builtin-actors and Filecoin proofs (rust-fil-proofs), with prior contributions to Filecoin core repos.",
  },
];

export const RND_EVALUATION: { label: string; value: string }[] = [
  {
    label: "Process",
    value:
      "Three phases: AI-assisted shortlist, committee vetting, final allocation",
  },
  { label: "Assessed", value: "Against Filecoin's 2026 network objectives" },
  {
    label: "Strongest",
    value: "Shipped products with named paying customers within six months",
  },
];
