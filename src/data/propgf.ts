import { EXTERNAL } from "./site";

/**
 * ProPGF Batch 3 overview — the page the old Hugo site served at /propgf and
 * the header's "Funding → Overview" item pointed at (hidden while no round is
 * open; the page stays reachable by URL). Copy is carried over from
 * content/propgf/_index.md unchanged; only the presentation is new.
 */

export const PROPGF_HERO = {
  eyebrow: "ProPGF · Batch 3",
  title: "Announcing the General Track",
  intro:
    "We're thrilled to announce **Filecoin ProPGF Batch 3** — a milestone-based funding program designed to accelerate innovation and strengthen the Filecoin ecosystem.",
  description:
    "Supporting projects that make Filecoin more **useful, resilient, and impactful** — from infrastructure and research to governance and user experience. Total funding amount will be announced soon.",
  applyText: "Apply on filpgf.io",
  applyHref: `${EXTERNAL.app}/programs/1479/`,
};

export type FocusCategory = {
  title: string;
  description: string;
  linkText?: string;
  href?: string;
};

export const PROPGF_FOCUS = {
  title: "What Batch 3 Funds",
  intro: "Batch 3 supports two categories of work.",
  items: [
    {
      title: "Core Infrastructure Maintenance",
      description:
        "Funding for the maintenance of core infrastructure the Filecoin network depends on. This is the foundational work that keeps the protocol reliable, performant, and safe: the implementations, critical libraries, dependencies and essential services that the rest of the ecosystem builds on top of.",
    },
    {
      title: "RFP Responses: Pod-Supporting Work",
      description:
        "Funding for projects submitted in response to specific RFPs (Requests for Proposals) published on filpgf.io and the Filecoin website the week of 01 June, 2026. These RFPs cover support and innovation work in service of Pods.",
      linkText: "Read the Batch 3 RFPs",
      href: "/blog/propgf-batch-3-call-for-builders/",
    },
  ] satisfies FocusCategory[],
};

export type TimelinePhase = {
  number: string;
  title: string;
  dates: string;
  description: string;
};

export const PROPGF_TIMELINE = {
  eyebrow: "ProPGF · General Track",
  title: "Funding Round Timeline",
  intro: "Key dates for Batch 3 of the ProPGF General Track.",
  phases: [
    {
      number: "1",
      title: "Applications Open",
      dates: "26 May 2026",
      description:
        "Apply on filpgf.io with your project proposal, team details, and funding request.",
    },
    {
      number: "2",
      title: "RFPs Published",
      dates: "Week of 01 June, 2026",
      description:
        "RFPs for Pod-supporting work go live on filpgf.io and the Filecoin website. Review them before preparing an RFP-response submission.",
    },
    {
      number: "3",
      title: "Early Bird Deadline",
      dates: "9 Jun 2026",
      description:
        "Cut-off for the June review window. Submissions by this date receive decisions by end of June. Early bird means earlier feedback only, not priority or higher chance of approval.",
    },
    {
      number: "4",
      title: "Final Application Deadline",
      dates: "16 Jun 2026",
      description: "Last day to submit Batch 3 applications.",
    },
    {
      number: "5",
      title: "Early Bird Reviews Complete",
      dates: "By end of Jun 2026",
      description:
        "Reviews completed, decisions targeted for the end of the month.",
    },
    {
      number: "6",
      title: "All Funding Decisions Shared",
      dates: "By mid-Jul 2026",
      description: "Final decisions communicated to all remaining applicants.",
    },
  ] satisfies TimelinePhase[],
};

export type DetailCard = {
  title: string;
  description: string;
  linkText?: string;
  href?: string;
};

export const PROPGF_DETAILS: DetailCard[] = [
  {
    title: "Funding Model",
    description:
      "All grants are **milestone-based**, with payouts tied to the completion and verification of approved deliverables.",
  },
  {
    title: "Selection Committee",
    description:
      "The committee will **incorporate some changes** to reflect Batch 3's focus. More details on the updated composition will be available once applications open.",
    linkText: "View Round 2 members",
    href: "https://filecoin.io/blog/posts/announcing-filecoin-propgf-batch-2-selection-committee/",
  },
];

export const PROPGF_CONNECT = {
  title: "Stay Connected",
  items: [
    {
      title: "Updates",
      description:
        "Join the [FIL PGF Telegram group](https://t.me/+nUc-d7FXmt1kOWVl) or [#filpgf Slack](https://filecoinproject.slack.com/archives/C08GGK4DAVC).",
    },
    {
      title: "Blog",
      description:
        "Follow the latest PGF program updates on the [Filecoin blog](https://www.filecoin.io/blog).",
    },
  ],
};

export const PROPGF_CTA = {
  title: "View past rounds",
  description:
    "Browse past Filecoin ProPGF rounds and the projects that have been funded so far.",
  buttonText: "View past rounds",
  buttonHref: EXTERNAL.app,
};
