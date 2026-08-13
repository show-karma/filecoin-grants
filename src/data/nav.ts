import { EXTERNAL } from "./site";

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
    label: "ProPGF",
    // The Hugo site pointed Overview at /propgf, which the rebuild folds into
    // the objectives section on the landing page.
    items: [
      { label: "Overview", href: "/#objectives" },
      { label: "Financials", href: EXTERNAL.financials },
    ],
    groups: [
      {
        label: "Grants",
        items: [
          { label: "Batch 1", href: projects(PROGRAMS.batch1) },
          { label: "Batch 2", href: projects(PROGRAMS.batch2) },
          {
            label: "Batch 3",
            href: `${EXTERNAL.app}/programs/${PROGRAMS.batch3}/`,
          },
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
  { label: "RetroPGF", href: EXTERNAL.retropgf },
  { label: "Blog", href: "/blog/" },
  {
    label: "More",
    items: [
      { label: "About Filecoin", href: EXTERNAL.filecoin },
      { label: "Upcoming Events", href: "https://fil.org/events/" },
      { label: "Forum", href: EXTERNAL.forum },
      { label: "Community", href: "https://filecoin.io/community" },
    ],
  },
  {
    label: "Resources",
    items: [
      { label: "Twitter", href: EXTERNAL.twitter },
      { label: "Discord", href: EXTERNAL.discord },
      { label: "GitHub", href: EXTERNAL.github },
    ],
  },
];

export const FOOTER_NAV: NavLink[] = [
  { label: "Objectives", href: "/#objectives" },
  { label: "Reporting", href: "/#reporting" },
  { label: "Apply", href: "/#funding" },
];
