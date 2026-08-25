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
  /** Links shown below any groups, so a menu reads groups-first. */
  items?: NavLink[];
  groups?: NavGroup[];
};

export type NavEntry = NavLink | NavMenu;

export const isMenu = (entry: NavEntry): entry is NavMenu => !("href" in entry);

/*
 * Community tracks, from GET /v2/tracks?communityUID=… — the ids are opaque
 * records rather than slugs, so they are pinned here with the names they
 * carry. The explorer filters on them (`trackIds` takes a comma-separated
 * list), which is what makes a menu entry show the projects in that track
 * rather than the batch they happened to be funded in.
 *
 * Funding moved from per-batch listings to these three standing tracks; the
 * batch ids are gone from the menu with them.
 */
const TRACKS = {
  kernel: "6a8c89712fbfc662a244471e",
  rnd: "6a8c89712fbfc662a2444720",
  revenueDevelopment: "6a8c89712fbfc662a244471f",
} as const;

const track = (id: string) => `${EXTERNAL.explorer}?trackIds=${id}`;

export const MAIN_NAV: NavEntry[] = [
  {
    label: "Funding",
    groups: [
      {
        label: "Funding Programs",
        items: [
          { label: "Kernel", href: track(TRACKS.kernel) },
          { label: "R&D", href: track(TRACKS.rnd) },
          {
            label: "Revenue Development",
            href: track(TRACKS.revenueDevelopment),
          },
        ],
      },
    ],
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
  { label: "Blog", href: "/blog/" },
];

export const FOOTER_NAV: NavLink[] = [
  { label: "Objectives", href: "/#objectives" },
  { label: "Reporting", href: "/#reporting" },
  { label: "Apply", href: "/#funding" },
];
