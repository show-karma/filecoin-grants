/**
 * Build-time reads from the Karma GAP API.
 *
 * These run once per build, so the published pages stay static and ship no
 * client JavaScript. A scheduled rebuild is what keeps them fresh.
 *
 * The API is never allowed to break a build: on any failure — network, non-2xx,
 * malformed payload, timeout — the last known values are used instead and the
 * reason is logged.
 */

import { KARMA } from "../data/site";

const API = KARMA.apiHost;
const COMMUNITY = "filecoin";
const TIMEOUT_MS = 15_000;

export type LiveCounts = {
  /** Distinct projects with at least one grant in the community. */
  projects: number;
  /** Milestones marked complete, and the total declared. */
  milestonesDone: number;
  milestonesTotal: number;
  /** False when the figures below are the committed fallbacks. */
  live: boolean;
};

/**
 * Last known good values, used when the API cannot be reached. Update these
 * alongside any deliberate change so a fallback build is never far off.
 */
export const FALLBACK_COUNTS: LiveCounts = {
  projects: 48,
  milestonesDone: 98,
  milestonesTotal: 197,
  live: false,
};

type Milestone = { completed?: boolean; data?: { completed?: boolean } };
type Grant = {
  projectUID?: string;
  originalProjectUID?: string;
  milestones?: Milestone[];
};

const isComplete = (milestone: Milestone) =>
  Boolean(milestone.completed ?? milestone.data?.completed);

export async function fetchLiveCounts(): Promise<LiveCounts> {
  try {
    const response = await fetch(
      `${API}/communities/${COMMUNITY}/grants?limit=200`,
      { signal: AbortSignal.timeout(TIMEOUT_MS) },
    );

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as { data?: Grant[] };
    const grants = payload.data ?? [];

    if (grants.length === 0) throw new Error("no grants returned");

    const projects = new Set<string>();
    let milestonesDone = 0;
    let milestonesTotal = 0;

    for (const grant of grants) {
      const projectId = grant.projectUID ?? grant.originalProjectUID;
      if (projectId) projects.add(projectId);

      for (const milestone of grant.milestones ?? []) {
        milestonesTotal += 1;
        if (isComplete(milestone)) milestonesDone += 1;
      }
    }

    return {
      projects: projects.size,
      milestonesDone,
      milestonesTotal,
      live: true,
    };
  } catch (error) {
    console.warn(
      `[karma] falling back to committed counts — ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return FALLBACK_COUNTS;
  }
}
