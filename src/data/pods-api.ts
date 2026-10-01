/**
 * Live Revenue Development Pods data, read per render.
 *
 * The same failure policy as the Kernel inventory: a broken or half-read
 * response would make the page state figures it cannot evidence, so any fetch
 * or parse failure degrades to `null` and the page renders the editorial
 * sections alone.
 *
 * One endpoint, unlike the Kernel's four. The whole dashboard is under 400
 * rows upstream and every section needs the same three pods, so splitting it
 * would cost four round trips to assemble one view.
 */

import { apiOrigin } from "../lib/api-origin";

/** Per-request budget. The payload is a few hundred rows at most. */
const REQUEST_TIMEOUT_MS = 20_000;

/** Trailing weeks a metric's change is measured across on the pod cards. */
export const DELTA_WINDOW_DAYS = 28;

/* ------------------------------------------------------------------ */
/* API shapes                                                           */
/* ------------------------------------------------------------------ */

export type PodReading = {
  date: string;
  value: number;
};

/**
 * Which way is good. Upstream's review tables carry neither this nor a unit —
 * the published notebook keeps both in a hand-maintained spec — so both are
 * optional here and the card states less rather than guessing: a ceiling read
 * as a floor turns "well under the limit" into "34% of target".
 */
export type MetricDirection = "higher_better" | "lower_better";

export type PodMetric = {
  metricKey: string;
  metricLabel: string;
  /**
   * In the same unit as the readings. Null where the pod committed no number,
   * or where the figure its reviews still carry is a target it has retired.
   */
  target: number | null;
  /** How the agreement writes it: a 2560 TiB target signed as "2.5 PiB". */
  targetLabel?: string | null;
  direction?: MetricDirection | null;
  /** "USD", "TiB", "minutes", … Absent where upstream states none. */
  unit?: string | null;
  series: PodReading[];
};

export type PodCommitment = {
  goalOrder: number;
  goalLabel: string;
  targetText: string | null;
  /** Upstream's own vocabulary: done, done_late, at_risk, off_track, … */
  status: string;
  statusLabel: string | null;
  isDelivered: boolean;
  achievedNotePublic: string | null;
  /** Joins the goal to one of `metrics` when a series measures it. */
  metricKey: string | null;
};

export type PodPipelineStage = {
  stage: string;
  stageOrder: number | null;
  /** open | won | lost | dormant — what reaching this stage means. */
  stageKind: string | null;
  /** True where upstream folded several thin stages into one row. */
  isFolded: boolean;
  entityCount: number;
  amountUsd: number | null;
  weightedUsd: number | null;
  pb: number | null;
};

export type PodPipeline = {
  /** `deal` carries value and probability; `partnership` carries neither. */
  entityKind: string;
  snapshotDate: string | null;
  totalEntities: number;
  openEntities: number;
  closedLostEntities: number;
  stages: PodPipelineStage[];
};

export type PodEntry = {
  podSlug: string;
  podDisplayName: string;
  podFullName: string;
  team: string;
  projectUID: string | null;
  committedUsd: number | null;
  paidToDateUsd: number | null;
  /**
   * False where the pod is paid on rails the tracker does not cover, which
   * makes `paidToDateUsd` a floor rather than the total — and makes the
   * programme's own total a floor with it.
   */
  paidIsTracked: boolean;
  roadmapLabel: string | null;
  roadmapText: string | null;
  roadmapAmountsRedacted: boolean;
  roadmapSource: string | null;
  commitments: PodCommitment[];
  metrics: PodMetric[];
  pipeline: PodPipeline | null;
};

export type PodsProgramStats = {
  podsFunded: number;
  committedUsd: number;
  paidToDateUsd: number;
  /** Pods whose payments the tracker covers, out of `podsFunded`. */
  podsWithTrackedPayments: number;
  commitmentsDelivered: number;
  commitmentsTotal: number;
  reviewsRead: number;
  latestReviewAt: string | null;
};

export type PodsData = {
  program: PodsProgramStats;
  pods: PodEntry[];
};

/* ------------------------------------------------------------------ */
/* Derived helpers                                                      */
/* ------------------------------------------------------------------ */

/** `$1.8M` / `$716K` / `$601`, null for nothing at all. */
export function formatUsd(amount: number | null | undefined): string | null {
  if (amount === null || amount === undefined || amount === 0) return null;
  if (Math.abs(amount) >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (Math.abs(amount) >= 1_000) return `$${Math.round(amount / 1_000)}K`;
  return `$${amount.toLocaleString("en-US")}`;
}

export const latestReading = (metric: PodMetric): PodReading | null =>
  metric.series.length > 0 ? metric.series[metric.series.length - 1]! : null;

/**
 * Movement over the trailing window, against the freshest reading rather than
 * against today: the pods report every other week, so measuring from now would
 * show a pod as flat for the fortnight between its own reviews.
 */
export function changeOverWindow(metric: PodMetric): number | null {
  const latest = latestReading(metric);
  if (!latest) return null;
  const cutoff = Date.parse(latest.date) - DELTA_WINDOW_DAYS * 86_400_000;
  const earlier = [...metric.series]
    .reverse()
    .find((reading) => Date.parse(reading.date) <= cutoff);
  if (!earlier) return null;
  return latest.value - earlier.value;
}

/**
 * Share of the target reached, for the progress bars. Only a target the
 * reading is meant to climb toward has a share: against a ceiling the same
 * arithmetic reads backwards, scoring a pod worst when it is furthest under
 * the limit.
 */
export function progressPct(metric: PodMetric): number | null {
  const latest = latestReading(metric);
  if (metric.direction !== "higher_better") return null;
  if (!latest || metric.target === null || metric.target === 0) return null;
  return Math.max(0, Math.min(100, (latest.value / metric.target) * 100));
}

/** True when the reading sits on the good side of a ceiling. */
export function withinCeiling(metric: PodMetric): boolean | null {
  const latest = latestReading(metric);
  if (metric.direction !== "lower_better") return null;
  if (!latest || metric.target === null) return null;
  return latest.value <= metric.target;
}

/**
 * Open book value, which only a pod reporting deals has: a partnership
 * tracker records neither a deal size nor a win probability, so the two
 * funnels are shown side by side and never added together.
 */
export function openBookUsd(pipeline: PodPipeline | null): number | null {
  if (!pipeline) return null;
  const open = pipeline.stages.filter((s) => s.stageKind === "open");
  if (open.every((s) => s.amountUsd === null)) return null;
  return open.reduce((sum, s) => sum + (s.amountUsd ?? 0), 0);
}

export function weightedBookUsd(pipeline: PodPipeline | null): number | null {
  if (!pipeline) return null;
  const open = pipeline.stages.filter((s) => s.stageKind === "open");
  if (open.every((s) => s.weightedUsd === null)) return null;
  return open.reduce((sum, s) => sum + (s.weightedUsd ?? 0), 0);
}

/* ------------------------------------------------------------------ */
/* Load                                                                 */
/* ------------------------------------------------------------------ */

async function getJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText} for ${url}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Called from page frontmatter rather than at module scope: a top-level await
 * would resolve once per warm serverless instance, so every regeneration would
 * answer with whatever the instance happened to read first and ISR's
 * expiration would buy nothing.
 */
export async function loadPodsData(): Promise<PodsData | null> {
  try {
    const data = await getJson<PodsData>(`${apiOrigin()}/v2/pods/overview`);
    if (!data?.pods?.length) return null;
    return data;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(
      `[pods] live data unavailable, rendering without it: ${reason}`,
    );
    return null;
  }
}
