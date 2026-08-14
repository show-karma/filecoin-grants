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
  forum: "https://github.com/filecoin-project/community/discussions",
} as const;

/**
 * Programme id for the batch the headline stats are drawn from.
 *
 * Deliberately NOT applied to every report link: the site spans three
 * programmes, and the Pods track is a different programme id again, so scoping
 * a site-wide link to one batch would silently narrow what it shows.
 */
export const PROGRAM_ID = "992";

/** Every report for that programme, unfiltered by type. */
export const PROGRAM_REPORTS_URL = `${EXTERNAL.reports}?programId=${PROGRAM_ID}`;

/** Funded projects for that programme. */
export const PROGRAM_PROJECTS_URL = `${EXTERNAL.explorer}?programId=${PROGRAM_ID}`;

/**
 * Report-type ids from the Karma reports API. Linking by type (rather than to a
 * dated report) always surfaces the latest of that type, so these never need a
 * manual date bump.
 */
export const REPORT_TYPES = {
  monthlyPods: "6a23268272df01209256e5b9",
  biweeklyProgress: "6a233d04e82a77f23c7838f7",
} as const;

/** Latest report of a type, across every programme. */
export const reportUrl = (type: keyof typeof REPORT_TYPES) =>
  `${EXTERNAL.reports}?type=${REPORT_TYPES[type]}`;

/** Latest report of a type, scoped to {@link PROGRAM_ID}. */
export const programReportUrl = (type: keyof typeof REPORT_TYPES) =>
  `${PROGRAM_REPORTS_URL}&type=${REPORT_TYPES[type]}`;

/**
 * Karma hosts (DEV-617). The product domain moved to karmahq.org; mailboxes
 * and the GAP API stay on .xyz until those moves land.
 */
export const KARMA = {
  siteUrl: "https://karmahq.org",
  widgetHost: "https://www.karmahq.org",
  contactEmail: "info@karmahq.xyz",
  apiHost: "https://gapapi.karmahq.xyz",
} as const;

export const SITE = {
  name: "filpgf.io",
  title: "Filecoin Public Goods Funding",
  description:
    "Filecoin's public goods funding puts capital behind the infrastructure, growth work, and research the network depends on. This is where that work is tracked — objective by objective, milestone by milestone.",
  administeredBy: "administered by the Blueshift Foundation",
} as const;
