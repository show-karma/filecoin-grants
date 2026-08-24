import { EXTERNAL, reportUrl } from "./site";

/**
 * Site navigation, restored from the Hugo site's menu so the header keeps the
 * destinations people already rely on. This is groundwork — the structure is
 * expected to change once the new IA settles.
 */

export type NavLink = { label: string; href: string };

/** A labelled run of links inside a dropdown, e.g. "Grants". */
export type NavGroup = { label: string; items: NavLink[] };

export type NavMenu = {
  label: string;
  /** Links shown above any groups. */
  items?: NavLink[];
  groups?: NavGroup[];
};

export type NavEntry = NavLink | NavMenu;

export const isMenu = (entry: NavEntry): entry is NavMenu => !("href" in entry);

const PROGRAMS = {
  batch1: "1013",
  batch2: "992",
  batch3: "1479",
  pods: "1039",
} as const;

const projects = (id: string) => `${EXTERNAL.explorer}?programId=${id}`;
const applications = (id: string) =>
  `${EXTERNAL.app}/browse-applications?programId=${id}`;

export const MAIN_NAV: NavEntry[] = [
  {
    label: "Funding",
    items: [
      // The ProPGF overview (/propgf/) is deliberately not listed while no round
      // is open; the page stays reachable by URL. Restore the "Overview" item
      // here and in the app's whitelabel navbar together when a new RFP opens.
      {
        label: "Commitments & Disbursements",
        href: EXTERNAL.financials,
      },
      { label: "RetroPGF - Paused", href: EXTERNAL.retropgf },
    ],
    groups: [
      {
        label: "Grants",
        items: [
          { label: "Batch 1", href: projects(PROGRAMS.batch1) },
          { label: "Batch 2", href: projects(PROGRAMS.batch2) },
          { label: "Batch 3", href: projects(PROGRAMS.batch3) },
          { label: "Pods Track", href: projects(PROGRAMS.pods) },
        ],
      },
      {
        label: "Applications",
        items: [
          { label: "Batch 1", href: applications(PROGRAMS.batch1) },
          { label: "Batch 2", href: applications(PROGRAMS.batch2) },
          { label: "Batch 3", href: applications(PROGRAMS.batch3) },
          { label: "Pods Track", href: applications(PROGRAMS.pods) },
        ],
      },
    ],
  },
  {
    label: "Reports",
    items: [
      {
        label: "Filecoin ProPGF Monthly",
        href: reportUrl("propgfMonthly"),
      },
      {
        label: "Monthly Pods Report",
        href: reportUrl("monthlyPods"),
      },
      {
        label: "Bi-Weekly Progress Report",
        href: reportUrl("biweeklyProgress"),
      },
      { label: "All reports", href: EXTERNAL.reports },
    ],
  },
  { label: "Blog", href: "/blog/" },
  {
    label: "About",
    items: [
      { label: "Filecoin", href: EXTERNAL.filecoin },
      { label: "Upcoming Events", href: "https://fil.org/events/" },
    ],
  },
  /*
   * The app builds this menu from the tenant's `socialLinks`, under the name
   * its `socialLinksLabel` gives them — "Connect" for this tenant — including
   * the "Social" label it gives the Twitter link. Kept verbatim so the two
   * headers read as one.
   */
  {
    label: "Connect",
    items: [
      { label: "Social", href: EXTERNAL.twitter },
      { label: "Discord", href: EXTERNAL.discord },
      { label: "GitHub", href: EXTERNAL.github },
      { label: "Skills", href: EXTERNAL.skills },
    ],
  },
];

export const FOOTER_NAV: NavLink[] = [
  { label: "Objectives", href: "/#objectives" },
  { label: "Reporting", href: "/#reporting" },
  { label: "Apply", href: "/#funding" },
];
