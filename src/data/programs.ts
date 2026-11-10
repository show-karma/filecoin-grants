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
  notInScope?: string[];
  whoShouldApply?: string;
};

export const RND_RFPS: Rfp[] = [
  {
    title: "RFP 1: Complementary Security Testing of Filecoin EVM Deployments",
    objective:
      "add an independent layer of security testing for high-value FEVM contracts, complementing (not duplicating) FF Security's existing test harnesses.",
    problem:
      "Filecoin Solstice and USDFC hold real user value on FEVM, and Filecoin Pay contracts are becoming core infrastructure for Filecoin Onchain Cloud. FF Security already runs test harnesses for Solstice and USDFC, but one team's view leaves blind spots. FEVM also differs from Ethereum (actor model, gas, precompiles), so standard EVM tooling can miss Filecoin-specific issues.",
    inScope: [
      "New tests in the gaps: invariant/property-based fuzzing (Foundry, Echidna, Medusa), formal or symbolic checks on critical paths, and FEVM-specific edge cases.",
      "Targets: Solstice, USDFC, and Filecoin Pay contracts (v1, and v2 if stable).",
      "Responsible disclosure of any findings before public reporting.",
    ],
    notInScope: [
      "A full traditional audit of each codebase from scratch.",
      "Fixing the contracts (findings go to maintainers).",
      "Off-chain infrastructure and front ends.",
    ],
    whoShouldApply:
      "Smart-contract security teams or independent researchers with public audit or fuzzing work, ideally with experience in stablecoin/CDP systems (Liquity-style troves) and payment-rail contracts. FEVM experience is a strong plus.",
  },
  {
    title: "RFP 2: Programmable PoRep Proving Pipeline via FEVM",
    objective:
      "expose Filecoin's existing PoRep, PoSt and related proof verifiers to FEVM so that a Solidity contract can run a full PoRep / PoSt / prove-update cycle, enabling a PoRep+PDP-style system built entirely in FEVM.",
    problem:
      "Today, Filecoin's sealing proofs (PoRep, Window/WinningPoSt, ProveReplicaUpdates) can only be verified by built-in actors. Builders can use PDP from Solidity, but cannot plug into the stronger PoRep guarantees. The verifier logic already exists in the VM; it just isn't reachable from FEVM. Exposing it would let anyone build custom storage markets and proof systems as smart contracts.",
    inScope: [
      "Identifying the exact set of existing VM verification methods required.",
      "Exposing them to FEVM (e.g. as precompiles or callable actor methods) with <strong>no new cryptography or proof code</strong>.",
      "A reference Solidity contract that completes a full PoRep \u2192 PoSt \u2192 prove-update cycle on a devnet/calibnet.",
      "Gas benchmarks for each exposed call.",
    ],
    notInScope: [
      "New proof systems or changes to proof parameters.",
      "A production storage market built on top (that can be a follow-on RFP).",
    ],
    whoShouldApply:
      "Engineers familiar with ref-fvm, builtin-actors and Filecoin proofs (rust-fil-proofs), with prior contributions to Filecoin core repos.",
  },
  {
    title:
      "RFP 3: Bridging UCAN to Mainstream Web3, On-Chain Execution and AI Agents",
    objective:
      "make UCAN the practical way for wallet owners to delegate scoped, revocable authority to apps and AI agents, signable in the EVM wallets and passkeys people already use.",
    problem:
      "AI agents increasingly act on users' behalf: paying for storage, moving funds, calling contracts. Today that usually means handing an agent a private key or an unlimited approval. UCAN offers a hardened alternative: capability-based, attenuable, time-bound delegation. Three gaps block mainstream use: wallet friction (UCANs can't be signed as readable EIP-712 typed data in wallets like MetaMask, so users can't see what they are delegating), an incomplete execution loop (the Receipt spec, which proves what an invocation did, is unfinished, so agent actions can't be audited end to end), and implementation drift (JS, Rust and Go libraries lack shared test vectors, and the core spec has ambiguities).",
    inScope: [
      "EIP-712 varsig codec, with typed-data schemas for UCAN delegations and invocations.",
      "Finalised UCAN Receipt specification.",
      "WebAuthn support in varsig.",
      "Interop test-vector suite covering valid chains, expiry, invalid signatures and EIP-712/WebAuthn edge cases, validated against JS, Rust and Go libraries.",
      "Editorial and technical refinement of the core UCAN spec.",
      "AI-agent reference flow: a demo where a wallet owner delegates a narrow capability (e.g. spend up to X USDFC on Filecoin Pay for 7 days) to an agent, the agent invokes it, the receiving service validates the delegation chain off-chain, and a UCAN Receipt records what the agent did.",
    ],
    notInScope: [
      "A production agent framework or wallet product.",
      "New signature schemes beyond EIP-712 and WebAuthn.",
      "On-chain UCAN verification (e.g. Solidity verifier contracts) and storing UCAN delegations, invocations or receipts on-chain.",
    ],
  },
  {
    title:
      "RFP 4: Permissionless Orchestrators in the SRA (FIP-0118 Phase 2)",
    objective:
      "a design, specification and simulation for Phase 2 of FIP-0118, where anyone can register as a Service Orchestrator and shares of the service stream are set by an on-chain mechanism rather than SRA Governance judgment.",
    problem:
      "In Phase 1, SRA Governance admits and removes Service Orchestrators, and SplitRule divides the service stream in proportion to each Orchestrator's Filecoin Pay Volume (FPV). FIP-0118 plans to open registration permissionlessly in Phase 2. Once registration is open, volume alone is easy to game: an Orchestrator can pay itself to inflate FPV. Today, telling genuine demand from self-dealing is an off-chain judgment by SRA Governance, and Phase 2 needs a mechanism that does that job instead. FIP-0118's Phase 2 covers permissionless admission only; this RFP also asks for a new share metric, which goes beyond the FIP, and the move to Phase 2 will itself need a FIP.",
    inScope: [
      "Mechanism design and a written spec compatible with the SRA's share map write to f02 and FIP-0118.",
      "Attack analysis covering wash trading, Sybil Orchestrators and scorer collusion.",
      "An agent-based or economic simulation comparing candidate share metrics.",
      "<strong>Registration:</strong> how anyone registers as an Orchestrator — bond or lock size, eligibility checks, slashing or exit rules, and Sybil resistance.",
      "<strong>Share metric:</strong> which metric, other than or alongside volume, sets each Orchestrator's share, and why it is costly to fake (e.g. unique paying clients, retention, verified service quality, fee burn, stake-weighted demand).",
      "<strong>Scoring:</strong> who scores Orchestrators, comparable to how Bittensor validators score miners in a subnet — how scorers are selected, incentivised and kept honest, and how collusion is handled.",
      "<strong>Replacing governance judgment:</strong> what replaces SRA Governance's off-chain call on self-dealing, and what residual role, if any, governance keeps (e.g. emergency removal).",
      "<strong>Attribution interface:</strong> FIP-0118 makes Phase 2 depend on a standard on-chain attribution interface where service contracts expose their Orchestrator binding (to be specified in a future FRC) — propose this interface, or show how the design works with it.",
      "<strong>Transition:</strong> how to move from Phase 1 to Phase 2 without disrupting existing Orchestrators' payouts, including what the required FIP would contain.",
    ],
    notInScope: [
      "Production contracts and a governance vote (a FIP draft is welcome as a recommendation).",
    ],
    whoShouldApply:
      "Mechanism designers and cryptoeconomics researchers with published work on incentive systems, ideally familiar with Bittensor, Filecoin Pay and FIP-0118.",
  },
  {
    title: "RFP 5: Automatic New Streams in the SWA",
    objective:
      "a protocol that has the SWA register new streams in f02 and set their Weights from an on-chain signal, replacing the convention that each new stream needs an accepted FIP.",
    problem:
      "Registering a stream in f02 is already an on-chain write by the SWA. By governance convention, though, each new stream needs an accepted FIP, which is slow and limits experimentation. Bittensor shows another model: anyone can register a subnet by paying a burn (the amount becomes the subnet pool's initial reserve), and emissions are split across subnets by a market signal — net staking flows under Taoflow since November 2025, and a moving average of the subnet token price before that. Filecoin needs an equivalent that fits f02's constraints.",
    inScope: [
      "Mechanism design and a spec for the SWA and f02 changes.",
      "Attack analysis covering signal manipulation, Sybil streams and cartel staking.",
      "Comparison with Bittensor's dTAO/Taoflow experience, and a simulation.",
      "<strong>Hard constraint:</strong> non-burn weights must sum to at most 1 at all times, including during stream creation, removal and reweighting.",
      "<strong>Hard constraint:</strong> f02 caps streams at 8 (MAX_STREAMS), so the design must decide who gets a slot and how a slot is freed.",
      "<strong>Hard constraint:</strong> every SWA write goes through the timelock and objection window in FIP-0118 Section 4, so the design must work with that delay.",
      "<strong>Opening a stream:</strong> who can open one, at what cost (lock, bond, burn), how a slot is allocated under the 8-stream cap, and how a dead or abusive stream is closed.",
      "<strong>Weight signal:</strong> which on-chain signal sets Weights (e.g. staking or locking flows, fees paid, usage), and how it is smoothed against manipulation and flash attacks.",
      "<strong>Normalisation:</strong> how weights are scaled so the non-burn sum never exceeds 1, and what happens to the remainder (burn).",
      "<strong>Safety rails:</strong> caps per stream, rate limits on weight changes, minimum lifetime, how the timelock and objection window fit in, and any emergency governance override.",
      "<strong>Migration:</strong> how existing FIP-approved streams coexist with automatically created ones.",
    ],
    notInScope: ["Deploying the change on mainnet or passing the FIP."],
    whoShouldApply:
      "Cryptoeconomics researchers and protocol engineers with experience in emission design, ideally with direct knowledge of Bittensor's dTAO and Filecoin's f02 and SWA.",
  },
  {
    title: "RFP 6: Quantum Readiness for Filecoin",
    objective:
      "a thorough report and a working prototype on quantum readiness for Filecoin, covering security, performance and economics, so the network can plan its long-term cryptography with confidence.",
    problem:
      "Filecoin builds on well-established cryptographic primitives: BLS signatures and pairings, Groth16 and Poseidon in storage proofs, ECDSA, and the Blake, SHA and Keccak hash families. The wider industry, including Ethereum, is actively planning for quantum readiness, and new SNARK designs are changing which constructions are practical. The Filecoin ecosystem has done early research in this area; the next step is a structured report that builds on that work and turns it into a clear, costed path forward. Economics matter as much as security: post-quantum signatures and proofs are often much larger and more expensive to verify, and Filecoin cannot take on very large signatures or costly proofs, so any path forward has to keep fees, chain bandwidth and storage-provider costs practical.",
    inScope: [
      "For each primitive Filecoin depends on, the report must cover: where it is used in the protocol and code; its long-term security outlook; candidate alternatives; the cost of each alternative in signature and proof size, verification time, gas, chain bandwidth and storage-provider hardware; and a staged migration path, including what can change without a network upgrade.",
      "A working prototype of the most promising change — for example an alternative signature scheme or proof-system component running on a devnet, with measured performance and cost figures.",
      "Building on existing Filecoin research.",
      "Dependency mapping across Lotus, Forest, Venus, Curio, builtin-actors, ref-fvm and rust-fil-proofs.",
      "Comparison of alternatives with benchmarks, economic analysis, a prioritised roadmap, and comparison with other ecosystems' plans.",
    ],
    notInScope: [
      "Production implementation.",
      "Designing new cryptographic primitives.",
    ],
    whoShouldApply:
      "Applied cryptographers or cryptography research groups with post-quantum and SNARK/STARK expertise, ideally with experience in Filecoin proofs or other blockchain protocols.",
  },
  {
    title: "RFP 7: Stewardship of Filecoin Documentation",
    objective:
      "fund a team to keep docs.filecoin.io accurate, current with every protocol release, and easy for both developers and their coding agents to use.",
    problem:
      "docs.filecoin.io is the first place most builders meet Filecoin, and increasingly that first contact happens through a coding agent rather than a browser. Agents fetch the docs, generate code from them and don't flag what's stale, so out-of-date pages turn into broken builds without anyone noticing. The docs need to keep pace with every network upgrade and product release (FEVM, FOC, Filecoin Pay, Synapse SDK), and the agent-readiness and drift-monitoring work started in Batch 3 also needs to keep running.",
    inScope: [
      "<strong>Ownership:</strong> run the docs repo, build and deploy pipeline, issue triage and contribution review.",
      "<strong>Keeping current:</strong> update docs for each network upgrade and major release within an agreed window, and work with core teams (Lotus, Forest, Curio, FOC, FEVM) so changes reach the docs.",
      "<strong>Agent-readable by default:</strong> keep the site parseable in a single fetch (e.g. llms.txt, clean markdown endpoints) and point clearly to the Filecoin MCP server and CLI.",
      "<strong>Measuring quality:</strong> report regularly on freshness, open issues and how accurately agents answer common Filecoin developer tasks from the docs.",
      "<strong>Community contributions:</strong> make it easy for ecosystem teams to submit fixes, and review their PRs promptly.",
      "A clear cost for the core scope above, with any optional add-ons priced separately.",
      "Proposed quality targets, such as time from release to updated docs, issue response time and agent accuracy.",
    ],
    whoShouldApply:
      "DevRel, technical writing or developer-experience teams with hands-on Filecoin experience (FEVM, FOC, storage onboarding) and working relationships with core implementation teams. Experience making docs agent-readable is a strong plus. Teams already working on Filecoin docs are welcome to apply.",
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
