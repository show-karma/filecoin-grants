/**
 * Editorial copy for the pods dashboard, mirrored from OSO's published page.
 *
 * None of this is data. It is the wording OSO's notebook carries beside its
 * queries: which three KPIs each pod is judged on, what each one means, and
 * how the Filecoin ProPGF team describes the pods themselves. OSO states in
 * its own footer that the pod descriptions are "the pod's own description,
 * supplied by the Filecoin ProPGF team and carried verbatim rather than
 * authored here" — so they are carried verbatim here too.
 *
 * Every number on the page comes from the API. Nothing here is a figure.
 */

/**
 * How a figure is written. A count of signups and a cash total cannot share
 * one rule: "1,222" abbreviated to "1.2K" loses the precision the review
 * stated, and "$601" hides that the pod has collected cents.
 */
export type PodMetricFormat = "usd" | "usd2" | "int" | "pct" | "min" | "tib";

export type PodKpi = {
  /** Joins to `metricKey` on the API's metric entries. */
  metricKey: string;
  /** OSO's label, which reads better than the raw review wording. */
  label: string;
  format: PodMetricFormat;
  /**
   * `{target}` is filled from the commitment this metric measures, so a figure
   * the pod renegotiates is not left stale in prose beside the live one. A
   * sentence whose commitment states no target drops the clause rather than
   * rendering the placeholder.
   */
  note: string;
};

/**
 * Fills `{target}` from the commitment. With no target the sentence that
 * needed one is dropped — and where every sentence needed one, the caller's
 * fallback is used rather than an empty string, which would silently blank a
 * table cell.
 */
export function fillNote(
  note: string,
  target: string | null,
  fallback = "",
): string {
  if (target) return note.replace(/\{target\}/g, target);
  const kept = note
    .split(/(?<=\.)\s+/)
    .filter((sentence) => !sentence.includes("{target}"))
    .join(" ")
    .trim();
  return kept || fallback;
}

export type PodCopy = {
  /** Joins to `podSlug` on the API's pod entries. */
  slug: string;
  /** Name as the section heading renders it, linked to the pod's own site. */
  title: string;
  href: string;
  /** The long description, carried verbatim from the ProPGF team. */
  blurb: string;
  /** The one-line version, for the at-a-glance table. */
  summary: string;
  /** Sits under the heading: who runs it and what it covers. */
  strapline: string;
  /** Three per pod, in the order OSO shows them. */
  kpis: PodKpi[];
};

export const POD_COPY: PodCopy[] = [
  {
    slug: "foc",
    title: "Filecoin Onchain Cloud",
    href: "https://filecoin.cloud/",
    blurb:
      "Filecoin Onchain Cloud (FOC) serves Web3 application developers. It is building a production-grade onchain service layer: programmable warm object storage with cryptographic verification and automated onchain payments, exposed through developer APIs and SDKs. FOC includes warm storage with Filecoin PDP, simple onchain payments with Filecoin Pay and one-click IPFS pinning on the network with Filecoin Pin. The aim is to make Filecoin Onchain Cloud the default onchain payment layer for Web3's decentralized storage, retrieval, and compute needs.",
    summary:
      "Filecoin's developer-facing storage platform — warm storage, verifiable retrieval and proof-gated payments, plus the SDK surface teams build against.",
    strapline: "storage, payments and retrieval as one service",
    kpis: [
      {
        metricKey: "filecoin_pay_arr",
        format: "usd",
        label: "Onchain revenue (run rate)",
        note: "Annual run rate across every Filecoin Pay rail, read live off the contracts rather than extrapolated from settlements.",
      },
      {
        metricKey: "power_user_current",
        format: "int",
        label: "Recurring power users",
        /* The $500 is the metric's definition, not its target — it says what
         * counts as a power user, and the target is the number of them. It
         * lives upstream only inside the goal label, "Recurring power users
         * ($500+/mo)", where pulling it out would read worse than writing it.
         * A renegotiated target does not move it. */
        note: "Customers spending $500 or more a month, trailing 30 days. The test of whether anyone depends on the service, not just tries it.",
      },
      {
        metricKey: "dev_onboarding_time_minutes",
        format: "min",
        label: "Developer onboarding",
        note: "Docs to first stored piece, measured end to end in every review. Lower is better, and it has been under the ceiling all year.",
      },
    ],
  },
  {
    slug: "ldo",
    title: "Large Data Onboarding",
    href: "https://www.fidl.tech/",
    blurb:
      "Large Data Onboarding (LDO) serves the institutions and applications that need large public and scientific datasets onboarded and kept retrievable. It builds Filecoin-native tooling and market mechanisms, including a workflow that pools many data contributors into a single provable storage deal, dataset lifecycle management, and paid retrievals, so that archival, library-level data stays verifiable and available on demand. Its pipeline is live, with hundreds of terabytes onboarded.",
    summary:
      "Large dataset onboarding at pool scale — pooled storage provider capacity, audited allocation, a public dataset directory and paid retrievals.",
    strapline: "large dataset onboarding and paid retrieval",
    kpis: [
      {
        metricKey: "total_tib_onboarded",
        format: "tib",
        label: "Data onboarded",
        note: "Against a {target} commitment. The pool has the room — capacity cleared its own target — but clients have not filled it.",
      },
      {
        metricKey: "number_of_sps_participating",
        format: "int",
        label: "Providers in the pool",
        note: "Storage providers actually taking pool data. Named the tightest constraint in almost every review.",
      },
      {
        metricKey: "of_successful_executions_of_paid_retrievals",
        format: "pct",
        label: "Paid-retrieval success",
        note: "The product shipped and works. The rate stays at zero because no provider has adopted it yet, which is an adoption problem rather than a reliability one.",
      },
    ],
  },
  {
    slug: "web2",
    title: "Web2 Object Storage",
    href: "https://fil.one/",
    blurb:
      "Web2 Object Storage (Fil One) serves Web2 developers who just want object storage that works. It offers a self-serve, S3-compatible path that turns familiar upload-and-retrieve usage into recurring, paid, onchain Filecoin deals across multiple ecosystem on-ramps (the services that move data onto Filecoin). The product launched this spring and is converting its first paying customers.",
    summary:
      "Enterprise object storage — S3-compatible storage on Filecoin for the petabyte-scale buyers that move on price, durability and compliance.",
    strapline: "S3-compatible object storage and enterprise demand",
    kpis: [
      {
        metricKey: "total_signups",
        format: "int",
        label: "Signups",
        note: "Top of the self-serve funnel. Growing steadily, and the only part of the motion that clearly works.",
      },
      {
        metricKey: "paid_customers",
        format: "int",
        label: "Paying customers",
        note: "Accounts that converted from a trial to a card. No numeric target was committed for this one.",
      },
      {
        metricKey: "revenue_collected_usd",
        format: "usd2",
        label: "Revenue collected",
        note: "Cash actually collected to date — not a run rate. Set against a stated ambition of {target}, this is the gap the enterprise pipeline at the foot of this page has to close.",
      },
    ],
  },
];

export const podCopy = (slug: string): PodCopy | undefined =>
  POD_COPY.find((entry) => entry.slug === slug);

/** How each pod's revenue line should be read, for the side-by-side table. */
export const REVENUE_BASIS: Record<
  string,
  { reports: string; reading: string; readingWithoutTarget: string }
> = {
  foc: {
    reports: "Filecoin Pay ARR (run rate)",
    reading: "against a {target} commitment",
    readingWithoutTarget: "against its own funding commitment",
  },
  ldo: {
    reports: "no revenue line reported",
    reading:
      "the pod carries capacity and retrieval targets, not a revenue target",
    readingWithoutTarget:
      "the pod carries capacity and retrieval targets, not a revenue target",
  },
  web2: {
    reports: "cash collected to date",
    reading: "collected cash, not a run rate — stated ambition is {target}",
    readingWithoutTarget: "collected cash, not a run rate",
  },
};
