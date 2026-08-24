/**
 * Per-render reads from the Karma GAP API.
 *
 * The homepage is served on demand and cached by Vercel ISR, so these run once
 * per regeneration rather than once per build, and the page ships no client
 * JavaScript either way.
 *
 * The API is never allowed to break a render: on any failure — network, non-2xx,
 * malformed payload, timeout — the last known values are used instead and the
 * reason is logged. The new cost of that policy is that a fallback render is
 * cacheable, so an outage during a regeneration can show committed figures for
 * up to an expiration window instead of merely failing a deploy.
 */

import { apiOrigin } from "./api-origin";

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

/**
 * Community-wide funding figures, read from /v2/communities/:slug/metrics.
 *
 * Every field is nullable because the `funding` block is only served by the
 * newer backend — production answers the same endpoint without it, and that is
 * a normal outcome here, not a failure. A null means "this build has no live
 * figure for that stat", and the caller substitutes its own committed value.
 *
 * The fallbacks deliberately do not live here: the committed figures for these
 * stats already exist in src/data/landing.ts (FINANCIALS, PORTFOLIO) and in
 * FALLBACK_COUNTS above. Baking copies into this module would give each stat
 * two sources of truth that drift apart.
 */
export type CommunityMetrics = {
  /** Distinct projects funded across the community's programs. */
  distinctProjects: number | null;
  /** Mean milestone completion across funded projects, 0–100. */
  avgMilestoneCompletion: number | null;
  /** Total allocated across all programs, in the community's primary currency. */
  allocated: number | null;
  /** Per-track funding. Empty when the API served no usable `byTrack` block. */
  byTrack: TrackFunding[];
  /** False when nothing usable came back and every field above is null. */
  live: boolean;
};

/**
 * One row of `funding.byTrack`. `trackId` is deliberately dropped: it is an
 * opaque backend id with no map on this side, so the name is the only key a
 * caller can match on.
 */
export type TrackFunding = {
  /** As returned, for display; match on it with `trackFor`, not by identity. */
  track: string;
  allocated: number | null;
  disbursed: number | null;
  projects: number | null;
  avgMilestoneCompletion: number | null;
};

export const FALLBACK_METRICS: CommunityMetrics = {
  distinctProjects: null,
  avgMilestoneCompletion: null,
  allocated: null,
  byTrack: [],
  live: false,
};

type FundingTotals = {
  allocated?: unknown;
  distinctProjects?: unknown;
  avgMilestoneCompletion?: unknown;
};

type MetricsResponse = {
  funding?: { totals?: FundingTotals; byTrack?: unknown };
};

/**
 * A figure is only usable when it is a positive finite number. Zero is rejected
 * along with null: an unpopulated field and a genuine zero are indistinguishable
 * on the wire, and publishing "0 projects" or "0%" understates the programme far
 * worse than showing the committed figure would.
 */
const usableFigure = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;

/**
 * Rows without a usable name are dropped: the name is the only key callers can
 * match on, so a nameless row is unreachable rather than merely incomplete.
 */
const parseTracks = (byTrack: unknown): TrackFunding[] => {
  if (!Array.isArray(byTrack)) return [];

  return byTrack.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const track = (row as { track?: unknown }).track;
    if (typeof track !== "string" || track.trim() === "") return [];

    const fields = row as Record<string, unknown>;
    return [
      {
        track: track.trim(),
        allocated: usableFigure(fields.allocated),
        disbursed: usableFigure(fields.disbursed),
        projects: usableFigure(fields.projects),
        avgMilestoneCompletion: usableFigure(fields.avgMilestoneCompletion),
      },
    ];
  });
};

/**
 * Track names are the join key between the API and the objectives on the page,
 * and the two are maintained by different people — so the match is
 * case-insensitive and whitespace-tolerant. No match is a normal outcome: the
 * caller keeps its own figure and nothing is logged.
 */
export const trackFor = (
  metrics: CommunityMetrics,
  name: string,
): TrackFunding | null => {
  const wanted = name.trim().toLowerCase();
  return (
    metrics.byTrack.find((row) => row.track.toLowerCase() === wanted) ?? null
  );
};

/**
 * Whether the per-track allocations add up to the community total.
 *
 * They do not today — byTrack sums to $9,966,741 against a $8,642,697 total —
 * which is the evidence that the upstream track mapping, not the site, is what
 * is wrong. Exported so a test can pin the discrepancy: when this starts
 * returning true, the per-track figures are worth trusting and the static
 * footers in src/data/landing.ts can be switched over.
 */
export const tracksReconcile = (metrics: CommunityMetrics): boolean => {
  if (metrics.allocated === null || metrics.byTrack.length === 0) return false;
  const summed = metrics.byTrack.reduce(
    (total, row) => total + (row.allocated ?? 0),
    0,
  );
  // A dollar of tolerance: the API rounds, and cent-level drift is not a
  // mapping error.
  return Math.abs(summed - metrics.allocated) <= 1;
};

/**
 * Split out from the fetch so the shapes this has to survive — full payload,
 * production payload with no funding block, malformed body, totals with holes
 * in it — are all exercisable without a network.
 */
export function parseCommunityMetrics(payload: unknown): CommunityMetrics {
  const funding = (payload as MetricsResponse | null)?.funding;
  const totals = funding?.totals;
  const byTrack = parseTracks(funding?.byTrack);

  if (!totals || typeof totals !== "object") {
    return byTrack.length ? { ...FALLBACK_METRICS, byTrack, live: true } : FALLBACK_METRICS;
  }

  const distinctProjects = usableFigure(totals.distinctProjects);
  const avgMilestoneCompletion = usableFigure(totals.avgMilestoneCompletion);
  const allocated = usableFigure(totals.allocated);

  return {
    distinctProjects,
    avgMilestoneCompletion,
    allocated,
    byTrack,
    live:
      distinctProjects !== null ||
      avgMilestoneCompletion !== null ||
      allocated !== null ||
      byTrack.length > 0,
  };
}

export async function fetchCommunityMetrics(): Promise<CommunityMetrics> {
  try {
    const response = await fetch(`${apiOrigin()}/v2/communities/${COMMUNITY}/metrics`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }

    const metrics = parseCommunityMetrics(await response.json());

    if (!metrics.live) {
      // Expected against the production API, which serves this endpoint
      // without a funding block. Reported as information, not as a failure.
      console.info(
        "[karma] community metrics carry no funding totals — using committed figures",
      );
    }

    return metrics;
  } catch (error) {
    console.warn(
      `[karma] falling back to committed figures — ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return FALLBACK_METRICS;
  }
}

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
      `${apiOrigin()}/communities/${COMMUNITY}/grants?limit=200`,
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
