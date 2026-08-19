export const EXTERNAL = {
  app: "https://app.filpgf.io",
  explorer: "https://app.filpgf.io/projects",
  reports: "https://app.filpgf.io/reports",
  financials: "https://app.filpgf.io/financials",
  filecoin: "https://www.filecoin.io/learn",
  filecoinCloud: "https://filecoin.cloud/",
  filOne: "https://fil.one/",
  retropgf: "https://www.fil-retropgf.io/",
  twitter: "https://twitter.com/Filecoin",
  discord: "https://discord.gg/yeQ2hcd2TD",
  github: "https://github.com/filecoin-project",
  skills: "https://github.com/show-karma/skills",
  slack: "https://filecoin.io/slack",
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
  /** "Filecoin ProPGF Monthly" — the programme-wide monthly. */
  propgfMonthly: "69e70e9a641448585f44e961",
  /** "Monthly Pods Report" — the Pods track's own monthly. */
  monthlyPods: "6a23268272df01209256e5b9",
  /** "Bi-Weekly Progress Report" */
  biweeklyProgress: "6a233d04e82a77f23c7838f7",
} as const;

/** Latest report of a type, across every programme. */
export const reportUrl = (type: keyof typeof REPORT_TYPES) =>
  `${EXTERNAL.reports}?type=${REPORT_TYPES[type]}`;

/** Latest report of a type, scoped to {@link PROGRAM_ID}. */
export const programReportUrl = (type: keyof typeof REPORT_TYPES) =>
  `${PROGRAM_REPORTS_URL}&type=${REPORT_TYPES[type]}`;

/**
 * Sign-in entry point.
 *
 * The session belongs to the app, so the app runs the dialog: this is a
 * hand-off to app.filpgf.io, which signs the visitor in on its own origin and
 * returns them here. Sign-in was briefly framed on this site instead; that is
 * gone, because Privy checks `frame-ancestors` against every ancestor of its
 * auth iframe and blocks it on any host it has not been told about — which
 * renders a dialog that looks fine and silently discards what you submit.
 */
export const LOGIN = {
  /* The app's own wording for the same button. */
  label: "Sign in",
  href: `${EXTERNAL.app}/?login=true`,
} as const;

/**
 * The identity hint: how this static site knows who is signed in.
 *
 * app.filpgf.io writes a cookie on the shared parent domain with a display name
 * and avatar, and the header reads it to show the account button instead of
 * "Sign in". Display only — it carries no token and gates nothing.
 *
 * Mirrors `tenantIdentityHintCookieDomain.filecoin` in gap-app-v2's
 * tenant-config.ts. The two live in different repos: change both.
 */
export const IDENTITY_HINT = {
  cookie: "karma_identity_hint",
  cookieDomain: ".filpgf.io",
} as const;

/**
 * Karma's assistant, running under the Filecoin tenant. A full public page in
 * the app — no login needed, it answers as a visitor — so the site links
 * straight to it rather than embedding anything.
 */
export const ASK_KARMA = {
  label: "Ask Karma",
  href: `${EXTERNAL.app}/ask-karma`,
  /** Opens the chat widget in place; `href` is the fallback if it fails to load. */
  chat: true,
} as const;

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
