export const EXTERNAL = {
  app: "https://app.filpgf.io",
  explorer: "https://app.filpgf.io/projects",
  reports: "https://app.filpgf.io/reports",
  financials: "https://app.filpgf.io/financials",
  filecoin: "https://filecoin.io/",
  filecoinCloud: "https://filecoin.cloud/",
  filOne: "https://fil.one/",
  retropgf: "https://www.fil-retropgf.io/",
  twitter: "https://twitter.com/Filecoin",
  discord: "https://discord.gg/yeQ2hcd2TD",
  github: "https://github.com/filecoin-project",
  slack: "https://filecoin.io/slack",
} as const;

/**
 * Report-type ids from the Karma reports API. Linking by type (rather than to a
 * dated report) always surfaces the latest of that type, so these never need a
 * manual date bump.
 */
export const REPORT_TYPES = {
  monthlyPods: "6a23268272df01209256e5b9",
  biweeklyProgress: "6a233d04e82a77f23c7838f7",
} as const;

export const reportUrl = (type: keyof typeof REPORT_TYPES) =>
  `${EXTERNAL.reports}?type=${REPORT_TYPES[type]}`;

export const SITE = {
  name: "filpgf.io",
  title: "Filecoin Public Goods Funding",
  description:
    "Filecoin's public goods funding puts capital behind the infrastructure, growth work, and research the network depends on. This is where that work is tracked — objective by objective, milestone by milestone.",
  administeredBy: "administered by the Blueshift Foundation",
} as const;

export type NavItem = { label: string; href: string };

/** Landing-page navigation. Program pages pass their own section nav. */
export const MAIN_NAV: NavItem[] = [
  { label: "Objectives", href: "/#objectives" },
  { label: "Reporting", href: "/#reporting" },
  { label: "Blog", href: "/blog/" },
  { label: "Funding", href: "/#funding" },
];

export const FOOTER_NAV: NavItem[] = [
  { label: "Objectives", href: "/#objectives" },
  { label: "Reporting", href: "/#reporting" },
  { label: "Apply", href: "/#funding" },
];
