/**
 * Markdown views of the site for AI agents: /llms.txt, /index.md (what the
 * homepage returns for `Accept: text/markdown`) and /404.md (the not-found body
 * for the same requests). See src/integrations/markdown-negotiation.ts for the
 * routing.
 *
 * The copy is drawn from src/data, the same exports the pages render, so the
 * Markdown cannot drift from the HTML. The live headline figures are left out
 * on purpose: these files are prerendered, so a number here would be a
 * build-time snapshot of what the homepage shows live.
 */

import { getCollection } from "astro:content";
import {
  ASK_KARMA,
  KARMA,
  EXTERNAL,
  PROGRAM_PROJECTS_URL,
  SITE,
  reportUrl,
} from "../data/site";
import { HOME_COPY, OBJECTIVES, REPORT_CADENCES } from "../data/landing";
import { NEXT_ROUND } from "../data/kernel";
import { PODS, REVDEV_FUNDING_FACTS, RND_OPEN_RFPS } from "../data/programs";
import { SKILLS } from "./skills";
import mcp from "../../mcp.json";

export type PostSummary = {
  id: string;
  title: string;
  description: string;
  date: Date;
};

/** Published blog posts, in the shape the views below take. */
export const postSummaries = async (): Promise<PostSummary[]> =>
  (await getCollection("blog", ({ data }) => !data.draft)).map((post) => ({
    id: post.id,
    title: post.data.title,
    description: post.data.description,
    date: post.data.date,
  }));

type Page = { path: string; title: string; summary: string };

/**
 * On-site pages. The three program pages are described under Programs, from
 * OBJECTIVES, so they only need a pointer here.
 */
const PAGES: Page[] = [
  { path: "/kernel/", title: "Kernel", summary: "program page" },
  {
    path: "/revenue-development/",
    title: "Revenue Development",
    summary: "program page, including the two pods",
  },
  { path: "/rnd/", title: "R&D", summary: "program page and focus areas" },
  {
    path: "/propgf/",
    title: "ProPGF",
    summary: "ProPGF Batch 3: scope, timeline, how the round runs, past rounds",
  },
  {
    path: "/roadmap/",
    title: "Roadmap",
    summary: "what is being built into the filpgf.io portal, and when",
  },
  {
    path: "/blog/",
    title: "Blog",
    summary: "program updates, new rounds, selection committees, open calls",
  },
];

const link = (label: string, href: string) => `[${label}](${href})`;

const absolute = (path: string, site: URL) => new URL(path, site).href;

const byDate = (posts: PostSummary[]) =>
  [...posts].sort((a, b) => b.date.getTime() - a.date.getTime());

const day = (date: Date) => date.toISOString().slice(0, 10);

/** How a program is entered, where the site says. */
const ENTRY: Record<string, string> = {
  Kernel: `${NEXT_ROUND.title}. ${NEXT_ROUND.description} ${link("Apply", NEXT_ROUND.ctaHref)}.`,
  "Revenue Development": `Funds ${REVDEV_FUNDING_FACTS[0].value} (${PODS.map((pod) => pod.name).join(" and ")}). ${REVDEV_FUNDING_FACTS[0].note}.`,
  "R&D": `${RND_OPEN_RFPS.title}. R&D is request-driven: the usual way in is a response to a published RFP.`,
};

const objectiveLines = (site: URL) =>
  OBJECTIVES.map((objective) =>
    [
      `### ${objective.index}. ${objective.title} — ${link(objective.program, absolute(objective.href, site))}`,
      "",
      objective.description,
      "",
      `- Funding model: ${objective.model}`,
      `- Measured by: ${objective.measured}`,
      `- How to get in: ${ENTRY[objective.program]}`,
    ].join("\n"),
  );

const reportLines = () =>
  REPORT_CADENCES.map(
    (report) =>
      `- **${report.title}** (${report.cadence.toLowerCase()}): ${report.description}` +
      (report.href
        ? ` ${link("Latest", report.href)}`
        : ` ${report.linkText}.`),
  );

const postLines = (posts: PostSummary[], site: URL) =>
  byDate(posts).map(
    (post) =>
      `- ${link(post.title, absolute(`/blog/${post.id}/`, site))} (${day(post.date)}): ${post.description}`,
  );

const appLines = () => [
  `- ${link("Projects Explorer", EXTERNAL.explorer)}: every project submitted to the programs`,
  `- ${link("Funded projects", PROGRAM_PROJECTS_URL)}`,
  `- ${link("Reports", EXTERNAL.reports)}: ${link("Filecoin ProPGF Monthly", reportUrl("propgfMonthly"))}, ${link("Monthly Pods Report", reportUrl("monthlyPods"))}, ${link("Bi-Weekly Progress Report", reportUrl("biweeklyProgress"))}`,
  `- ${link("Commitments & Disbursements", EXTERNAL.financials)}`,
  `- ${link(ASK_KARMA.label, ASK_KARMA.href)}: Karma's assistant for this program, no sign-in needed`,
];

/**
 * /llms.txt — https://llmstxt.org. An index, not a copy: one line per page,
 * app destination and skill, each linking to the source that holds the detail.
 */
export const llmsTxt = (site: URL): string =>
  [
    `# ${SITE.title}`,
    "",
    `> ${SITE.description}`,
    "",
    `${SITE.name} explains what each program funds and how. Applications, milestones, reports and payouts live in ${link("app.filpgf.io", EXTERNAL.app)}, run on Karma. For general Filecoin docs, see ${link("filecoin.io/learn", EXTERNAL.filecoin)}.`,
    "",
    "## Pages",
    "",
    `- ${link("Home", absolute("/", site))}: the three objectives and how progress is reported`,
    ...PAGES.map(
      (page) =>
        `- ${link(page.title, absolute(page.path, site))}: ${page.summary}`,
    ),
    "",
    "## App",
    "",
    `- ${link("Apply", NEXT_ROUND.ctaHref)}`,
    ...appLines(),
    "",
    "## Data",
    "",
    `- Karma: applications, grants, milestones, payouts and Kernel readings. Public GET on \`${KARMA.apiHost}\`, community \`filecoin\`; ${link("OpenAPI spec", `${KARMA.apiHost}/v2/docs/json`)}.`,
    `- OSO: metrics and code activity, through its MCP server at \`${mcp.mcpServers.oso.url}\` (OAuth). Kernel projects on Karma carry \`osoProjectSlug\`.`,
    "- Code: each project's own git repository.",
    "",
    "When sources disagree, Karma wins for amounts, milestone status and payments, OSO for metrics, git for code. Show both values.",
    "",
    "## Agent skills",
    "",
    `Install with \`npx skills add show-karma/filecoin-grants\`, or as a Claude Code or Codex plugin from the marketplace at ${link("show-karma/filecoin-grants", EXTERNAL.repo)}. Each skill below is also served from this site.`,
    "",
    ...SKILLS.map(
      (skill) =>
        `- ${link(skill.name, absolute(skill.path, site))}: ${skill.description.split(". ")[0]}.`,
    ),
    `- ${link("show-karma/skills", EXTERNAL.skills)}: Karma's skills for applying, posting milestones and verifying them`,
    "",
    "## Optional",
    "",
    `- ${link("Homepage as Markdown", absolute("/index.md", site))}`,
    `- ${link("Sitemap", absolute("/sitemap-index.xml", site))}`,
    "",
  ].join("\n");

/** /index.md — the homepage, section for section. */
export const homeMarkdown = (posts: PostSummary[], site: URL): string =>
  [
    `# ${HOME_COPY.heading}`,
    "",
    SITE.description,
    "",
    `${SITE.title} · ${SITE.administeredBy}. Agent guide: ${link("llms.txt", absolute("/llms.txt", site))}.`,
    "",
    `## ${HOME_COPY.objectives.title}`,
    "",
    HOME_COPY.objectives.intro,
    "",
    ...objectiveLines(site).flatMap((block) => [block, ""]),
    `## ${HOME_COPY.reporting.title}`,
    "",
    HOME_COPY.reporting.intro,
    "",
    ...reportLines(),
    "",
    ...appLines(),
    "",
    `## ${HOME_COPY.blog.title}`,
    "",
    HOME_COPY.blog.intro,
    "",
    ...postLines(posts, site),
    "",
    `## ${HOME_COPY.funding.title}`,
    "",
    HOME_COPY.funding.intro,
    "",
  ].join("\n");

/** /404.md — returned with a 404 status to Markdown requests. */
export const notFoundMarkdown = (site: URL): string =>
  [
    "# Page not found",
    "",
    `There is no page at this address on ${SITE.name}. Start from the ${link("agent guide", absolute("/llms.txt", site))}, the ${link("homepage", absolute("/", site))} or the ${link("sitemap", absolute("/sitemap-index.xml", site))}.`,
    "",
    ...PAGES.map((page) => `- ${link(page.title, absolute(page.path, site))}`),
    `- ${link("app.filpgf.io", EXTERNAL.app)}: applications, projects and reports`,
    "",
  ].join("\n");
