/**
 * Live Kernel inventory, read per render.
 *
 * /kernel is served on demand and cached by Vercel ISR, so this module is read
 * once per regeneration rather than once per build. `src/data/kernel.ts` keeps
 * the editorial copy the API cannot carry (tier prose, glossary, timeline);
 * this module supplies the counts, the commitments and their series.
 *
 * Failure policy: a broken or half-read inventory would make the page lie, so
 * any fetch or parse failure degrades to `null` and the page renders exactly as
 * it did before live metrics existed. Neither the build nor the request fails
 * on the API.
 *
 * The consequence of moving off the build is new and worth stating: a degraded
 * render is now cacheable. Under ISR an outage that happens to coincide with a
 * regeneration pins the inventory-less page in front of visitors for up to the
 * expiration window, where a build-time read could only ever fail a deploy and
 * leave the last good HTML live.
 */

const DEFAULT_ORIGIN = "https://gapapi.karmahq.xyz";

export const WINDOW_DAYS = 90;

/** Per-request budget. The indicators payload is ~400 KB per project. */
const REQUEST_TIMEOUT_MS = 30_000;

/** The API is unauthenticated but rate-limited; five in flight is polite. */
const INDICATOR_CONCURRENCY = 5;

/* ------------------------------------------------------------------ */
/* API shapes (verbatim from kernel-api-contract.md)                    */
/* ------------------------------------------------------------------ */

export type KernelSla = {
  scored: number;
  passed: number;
  metPct: number | null;
};

export type KernelTierOverview = {
  tier: string;
  description: string;
  fundingPosture: string;
  catalogued: number;
  inScope: number;
  measured: number;
  commitments: number;
  projects: number;
  readings: number;
  lastReadingAt: string | null;
  sla: KernelSla;
};

export type KernelProgramStats = {
  committedUsd: number;
  /** Absent in some backend fixtures, so treat as optional on the wire. */
  disbursedUsd?: number;
  fundedGrants: number;
  functionsInScope: number;
  functionsMeasured: number;
  measurementCoveragePct: number | null;
  unmeasuredInScope: number;
  healthMet: KernelSla;
  singleMaintainerCritical: number;
  projectsReporting: number;
};

export type KernelOverviewResponse = {
  windowDays: number;
  /** "Was anything judged at all" — not the same word as `sla.scored`. */
  scored: boolean;
  program: KernelProgramStats;
  tiers: KernelTierOverview[];
};

export type KernelFunctionApi = {
  kernelId: string;
  kernelFunction: string;
  tier: string;
  category: string;
  subCategory: string;
  kernelValue: string;
  isInScope: boolean;
  maintainers: number;
  measured: boolean;
  commitments: number;
  projectsReporting: number;
  readings: number;
  lastReadingAt: string | null;
  sla: KernelSla;
};

export type KernelProjectApi = {
  projectUID: string;
  team: string | null;
  osoProjectSlug: string | null;
  tiers: string[];
  kernels: number;
  commitments: number;
  readings: number;
  lastReadingAt: string | null;
  sla: KernelSla;
  committedUsd: number;
  disbursedUsd: number;
  grantRefs: string[];
};

export type IndicatorDatapoint = {
  id: string;
  /** Arrives as a string even for numbers. */
  value: string;
  /** Arrives as a JSON *string*, not an object. */
  breakdown: string | null;
  startDate: string;
  endDate: string;
  period: string | null;
  proof: string | null;
  thresholdOp: string | null;
  thresholdValue: number | null;
  source: string;
  createdAt: string;
  updatedAt: string;
};

export type ProjectIndicator = {
  id: string;
  name: string;
  description: string;
  unitOfMeasure: string;
  tier?: string | null;
  kernelId?: string | null;
  hasData: boolean;
  lastUpdatedAt: string | null;
  datapoints: IndicatorDatapoint[];
};

export type DatapointBreakdown = {
  metricName?: string;
  kernelId?: string;
  functionId?: string;
  commitmentType?: string;
  /** Key is omitted entirely for metrics missing from the OSO catalog. */
  direction?: string;
  team?: string;
  osoProjectSlug?: string;
  grantRef?: string;
  slaStatement?: string;
  method?: string;
  cadence?: string;
  thresholdSource?: string;
};

/* ------------------------------------------------------------------ */
/* Derived model                                                        */
/* ------------------------------------------------------------------ */

export type CommitmentDirection =
  | "lower_better"
  | "higher_better"
  | "target"
  | "status"
  | null;

export type CoverageUnit = "days" | "weeks" | "months" | "readings";

export type Reading = {
  date: string;
  value: number;
  /**
   * The bar that was in force when this reading was taken. Carried per reading
   * rather than per commitment because signing a bar in August must not
   * retroactively score July — see `judgePeriod`.
   */
  thresholdOp?: string | null;
  thresholdValue?: number | null;
};

export type Commitment = {
  functionId: string;
  indicatorId: string;
  kernelId: string;
  metricName: string;
  commitmentType: "health" | "growth";
  direction: CommitmentDirection;
  team: string;
  osoProjectSlug: string;
  cadence: string;
  method: string;
  slaStatement: string;
  grantRef: string | null;
  unitOfMeasure: string | null;
  source: string | null;
  proof: string | null;
  thresholdOp: string | null;
  thresholdValue: number | null;
  series: Reading[];
  sla: KernelSla;
  coverage: { read: number; expected: number; unit: CoverageUnit };
  interruptions: { startDate: string; length: number }[];
  latest: Reading | null;
  /** Added to the spec shape: the join key for function-level rollups. */
  projectUID: string;
};

/**
 * `commitments` carries the resolved commitments, not the API's count of them —
 * the count survives as `declaredCommitments` so a mismatch between what the
 * rollup claims and what the indicators actually returned stays visible.
 */
export type FunctionEntry = Omit<KernelFunctionApi, "commitments"> & {
  commitments: Commitment[];
  declaredCommitments: number;
  teams: string[];
  committedUsd: number;
  grantRefs: string[];
};

export type ProjectEntry = Omit<KernelProjectApi, "commitments"> & {
  commitments: Commitment[];
  declaredCommitments: number;
};

export type KernelData = {
  windowDays: number;
  program: KernelProgramStats;
  tiers: KernelTierOverview[];
  functions: FunctionEntry[];
  projects: ProjectEntry[];
  generatedAt: string;
};

/* ------------------------------------------------------------------ */
/* Pure helpers                                                         */
/* ------------------------------------------------------------------ */

/**
 * `breakdown` is a JSON string on the wire. One malformed row must cost us that
 * row, never the build, so every failure collapses to `null`.
 */
export function parseBreakdown(raw: string | null | undefined): DatapointBreakdown | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as DatapointBreakdown;
  } catch {
    return null;
  }
}

const RECOGNIZED_OPS = new Set(["<", "<=", ">", ">=", "=", "=="]);

/**
 * Three-valued on purpose: `null` means *unjudgeable* (no bar in force, or an
 * operator we do not understand), which is not the same as a missed threshold.
 * Every threshold is null upstream today, so today everything is unjudgeable —
 * the day the bars are signed, the same code starts scoring.
 */
export function judge(
  value: number,
  op: string | null | undefined,
  threshold: number | null | undefined,
): boolean | null {
  if (op == null || threshold == null) return null;
  if (!Number.isFinite(value) || !Number.isFinite(threshold)) return null;
  if (!RECOGNIZED_OPS.has(op)) return null;
  switch (op) {
    case "<":
      return value < threshold;
    case "<=":
      return value <= threshold;
    case ">":
      return value > threshold;
    case ">=":
      return value >= threshold;
    default:
      return value === threshold;
  }
}

/**
 * The cadence is how often the SLA is *judged*, not how often the sync writes.
 * A nightly backfill files eight readings against a monthly commitment, so a
 * reading day is not a reading period — everything judged or counted below is
 * bucketed by this key first.
 */
export function periodKey(date: string, cadence: string | null | undefined): string | null {
  const normalized = (cadence ?? "").trim().toLowerCase();
  switch (normalized) {
    case "daily":
      return date;
    case "weekly":
      return isoWeekKey(date);
    case "monthly":
      return date.slice(0, 7);
    default:
      return null;
  }
}

/** ISO week, year-qualified so the last days of December cannot collide with January. */
function isoWeekKey(date: string): string {
  const day = new Date(`${date}T00:00:00.000Z`);
  // Shift to the Thursday of this ISO week: that day always sits in the ISO year.
  const weekday = (day.getUTCDay() + 6) % 7;
  day.setUTCDate(day.getUTCDate() - weekday + 3);
  const isoYear = day.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstWeekday = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstWeekday + 3);
  const week =
    1 + Math.round((day.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

export type ReadingPeriod = {
  key: string;
  /** Position on the cadence's own axis; `null` when the cadence is unknown. */
  index: number | null;
  readings: Reading[];
};

const MS_PER_DAY = 86_400_000;

/**
 * Position of a date on the cadence's axis, so two periods can be tested for
 * adjacency. `null` for an unknown cadence, where there is no axis to sit on.
 */
export function periodIndex(date: string, cadence: string | null | undefined): number | null {
  const normalized = (cadence ?? "").trim().toLowerCase();
  const time = Date.parse(`${date}T00:00:00.000Z`);
  if (Number.isNaN(time)) return null;
  switch (normalized) {
    case "daily":
      return Math.floor(time / MS_PER_DAY);
    case "weekly": {
      const day = new Date(time);
      // Monday of this ISO week, so the axis steps exactly one per week.
      const weekday = (day.getUTCDay() + 6) % 7;
      return Math.floor((time - weekday * MS_PER_DAY) / (7 * MS_PER_DAY));
    }
    case "monthly": {
      const day = new Date(time);
      return day.getUTCFullYear() * 12 + day.getUTCMonth();
    }
    default:
      return null;
  }
}

/**
 * Readings grouped into the periods the cadence judges, ascending. An unknown
 * cadence has no period to group into, so each reading stands alone.
 */
export function groupByPeriod(
  series: Reading[],
  cadence: string | null | undefined,
): ReadingPeriod[] {
  const periods: ReadingPeriod[] = [];
  const index = new Map<string, ReadingPeriod>();
  for (const reading of series) {
    const key = periodKey(reading.date, cadence) ?? reading.date;
    const existing = index.get(key);
    if (existing) {
      existing.readings.push(reading);
      continue;
    }
    const period: ReadingPeriod = {
      key,
      index: periodIndex(reading.date, cadence),
      readings: [reading],
    };
    index.set(key, period);
    periods.push(period);
  }
  return periods;
}

/**
 * A period's verdict is the worst of its readings: judged and missed if any
 * judgeable reading missed, judged and met if they all met, unjudgeable if none
 * could be judged. Hiding a mid-period breach behind a healthy last reading
 * would make the page overstate uptime, and coverage counts the same periods.
 *
 * Each reading is judged against the bar it carried, and `op`/`threshold` are
 * only a fallback for readings that carry none. The alternative — applying the
 * newest bar across the whole window — would score readings taken before anyone
 * agreed to that bar, and would disagree with the API's own pooled `sla`, which
 * judges per datapoint row. A reading taken before its bar was signed shows as
 * indeterminate, which is the truth.
 */
export function judgePeriod(
  period: ReadingPeriod,
  op: string | null | undefined,
  threshold: number | null | undefined,
): boolean | null {
  let verdict: boolean | null = null;
  for (const reading of period.readings) {
    const readingOp = reading.thresholdOp ?? op;
    const readingThreshold = reading.thresholdValue ?? threshold;
    const met = judge(reading.value, readingOp, readingThreshold);
    if (met === null) continue;
    if (met === false) return false;
    verdict = true;
  }
  return verdict;
}

/**
 * `metPct` is null — never 0 — when nothing could be judged, so the page can
 * render "—" instead of claiming a total failure. Scored in cadence periods, so
 * a monthly commitment read nightly still scores three months, not ninety days.
 */
export function computeSla(
  series: Reading[],
  op: string | null | undefined,
  threshold: number | null | undefined,
  cadence?: string | null,
): KernelSla {
  let scored = 0;
  let passed = 0;
  for (const period of groupByPeriod(series, cadence)) {
    const met = judgePeriod(period, op, threshold);
    if (met === null) continue;
    scored += 1;
    if (met) passed += 1;
  }
  return {
    scored,
    passed,
    metPct: scored > 0 ? Math.round((passed / scored) * 1000) / 10 : null,
  };
}

/**
 * How many readings the cadence promises over the window. An unrecognised
 * cadence has no promise to measure against, so coverage falls back to a raw
 * reading count rather than inventing a denominator.
 */
export function expectedPeriods(
  cadence: string | null | undefined,
  windowDays: number,
): { expected: number | null; unit: CoverageUnit } {
  const normalized = (cadence ?? "").trim().toLowerCase();
  switch (normalized) {
    case "daily":
      return { expected: windowDays, unit: "days" };
    case "weekly":
      return { expected: Math.ceil(windowDays / 7), unit: "weeks" };
    case "monthly":
      return { expected: Math.ceil(windowDays / 30), unit: "months" };
    default:
      return { expected: null, unit: "readings" };
  }
}

/**
 * Coverage counts cadence periods that hold at least one reading, against the
 * periods the window expects — both sides of the fraction in the same unit, so
 * "8 of 3 months read" can no longer happen. A period read twice is read once.
 */
export function computeCoverage(
  series: Reading[],
  cadence: string | null | undefined,
  windowDays: number,
): { read: number; expected: number; unit: CoverageUnit } {
  const { expected, unit } = expectedPeriods(cadence, windowDays);
  const periods = groupByPeriod(series, cadence).length;
  // A boundary period can still straddle the window edge; the promise is the
  // ceiling, so cap rather than print more periods read than exist.
  const read = expected === null ? periods : Math.min(periods, expected);
  return { read, expected: expected ?? read, unit };
}

/**
 * Maximal runs of consecutive judged-and-missed cadence periods. Absent periods
 * are not failures — they are simply not in the series — so a gap ends a run
 * rather than extending it, and `length` counts periods in the coverage unit.
 */
export function findInterruptions(
  series: Reading[],
  op: string | null | undefined,
  threshold: number | null | undefined,
  cadence?: string | null,
): { startDate: string; length: number }[] {
  const runs: { startDate: string; length: number }[] = [];
  let current: { startDate: string; length: number } | null = null;
  let previousIndex: number | null = null;
  for (const period of groupByPeriod(series, cadence)) {
    const met = judgePeriod(period, op, threshold);
    const reading = period.readings[0] as Reading;
    if (met === false) {
      // Two misses only belong to one outage when their periods are adjacent.
      // A period that reported nothing sits between them unseen, and a silent
      // period is missing data, not a continuing failure.
      const adjacent =
        current !== null &&
        previousIndex !== null &&
        period.index !== null &&
        period.index === previousIndex + 1;
      if (current && adjacent) {
        current.length += 1;
      } else {
        current = { startDate: reading.date, length: 1 };
        runs.push(current);
      }
      previousIndex = period.index;
      continue;
    }
    current = null;
    previousIndex = period.index;
  }
  return runs;
}

/**
 * Rounded money for headline copy. `null` signals "no award", which each
 * surface words differently ("no award this batch" / "no active grant") — this
 * helper must never render "$0".
 */
export function formatUsd(amount: number | null | undefined): string | null {
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return null;
  if (amount >= 1_000_000) {
    const millions = (amount / 1_000_000).toFixed(2).replace(/\.?0+$/, "");
    return `$${millions}M`;
  }
  if (amount >= 1_000) return `$${Math.round(amount / 1_000)}k`;
  return `$${Math.round(amount)}`;
}

/** ISO timestamps carry a time we never show; the day is the period identity. */
function toDay(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * The day the window ends on: today, in UTC.
 *
 * Anchoring on the freshest reading instead would make a stalled sync invisible
 * — the window would slide back with the data and every commitment would read
 * "90 of 90 days" while nothing had reported for a week. Anchoring on the build
 * date lets those trailing days render as missing, which is the whole point of
 * a coverage figure. It is still deterministic within a build: resolved once,
 * before any commitment is derived.
 */
export function buildDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Latest day present anywhere in the payload — the freshness signal ("last read
 * on …"), not the window anchor.
 */
export function maxReadingDate(indicators: ProjectIndicator[]): string | null {
  let max: string | null = null;
  for (const indicator of indicators) {
    for (const dp of indicator.datapoints ?? []) {
      const day = toDay(dp.endDate ?? dp.startDate);
      if (max === null || day > max) max = day;
    }
  }
  return max;
}

/**
 * Keep the readings inside the rolling window. The reference day counts as one
 * of the `windowDays`, so a daily commitment tops out at exactly the window and
 * can never report "91 of 90 days read".
 */
export function windowSeries(
  series: Reading[],
  windowDays: number,
  referenceDate: string | null,
): Reading[] {
  if (!referenceDate || series.length === 0) return series;
  const cutoff = new Date(`${referenceDate}T00:00:00.000Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - (windowDays - 1));
  const cutoffDay = cutoff.toISOString().slice(0, 10);
  return series.filter((reading) => reading.date >= cutoffDay);
}

/**
 * One reading per day, ascending. The API can repeat a date across a re-sync;
 * the later row wins because it is the corrected one.
 */
export function normalizeSeries(datapoints: IndicatorDatapoint[]): Reading[] {
  const byDate = new Map<string, Reading>();
  for (const dp of datapoints) {
    // `Number("")` is 0, and an empty value is a missing reading rather than a
    // healthy zero — the two must never collapse into each other.
    const raw = typeof dp.value === "string" ? dp.value.trim() : dp.value;
    if (raw === "" || raw == null) continue;
    const value = Number(raw);
    // A non-numeric reading is unjudgeable and unchartable; dropping it keeps
    // `value: number` honest, and it never happens for kernel metrics today.
    if (!Number.isFinite(value)) continue;
    const date = toDay(dp.endDate ?? dp.startDate);
    byDate.set(date, {
      date,
      value,
      thresholdOp: dp.thresholdOp ?? null,
      thresholdValue: dp.thresholdValue == null ? null : Number(dp.thresholdValue),
    });
  }
  return [...byDate.values()].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
  );
}

const DIRECTIONS = new Set(["lower_better", "higher_better", "target", "status"]);

function readDirection(raw: string | undefined): CommitmentDirection {
  return raw && DIRECTIONS.has(raw) ? (raw as CommitmentDirection) : null;
}

/**
 * The threshold in force for the window. Thresholds are per-datapoint columns
 * and are null everywhere today; the most recent non-null one wins so that a
 * newly signed bar takes effect immediately.
 */
function readThreshold(datapoints: IndicatorDatapoint[]): {
  op: string | null;
  value: number | null;
} {
  for (let i = datapoints.length - 1; i >= 0; i -= 1) {
    const dp = datapoints[i];
    if (dp && dp.thresholdOp != null && dp.thresholdValue != null) {
      return { op: dp.thresholdOp, value: Number(dp.thresholdValue) };
    }
  }
  return { op: null, value: null };
}

/**
 * One indicator on one project is one commitment. Returns `null` when the rows
 * carry no parseable breakdown — without it there is no function to hang the
 * commitment on.
 */
export function buildCommitment(
  projectUID: string,
  indicator: ProjectIndicator,
  options: { windowDays?: number; referenceDate?: string | null } = {},
): Commitment | null {
  const windowDays = options.windowDays ?? WINDOW_DAYS;
  const datapoints = indicator.datapoints ?? [];
  let breakdown: DatapointBreakdown | null = null;
  let sample: IndicatorDatapoint | null = null;
  for (const dp of datapoints) {
    const parsed = parseBreakdown(dp.breakdown);
    if (parsed) {
      breakdown = parsed;
      sample = dp;
      break;
    }
  }
  const kernelId = breakdown?.kernelId ?? indicator.kernelId ?? null;
  if (!breakdown || !kernelId) return null;

  // The indicators endpoint is unwindowed, so a series can run to hundreds of
  // readings; everything derived below is computed on the window only.
  const referenceDate = options.referenceDate ?? buildDate();
  const series = windowSeries(normalizeSeries(datapoints), windowDays, referenceDate);
  const commitmentType = breakdown.commitmentType === "growth" ? "growth" : "health";
  const { op, value } = readThreshold(datapoints);
  const cadence = breakdown.cadence ?? "";

  return {
    functionId: breakdown.functionId ?? indicator.name,
    indicatorId: indicator.id,
    kernelId,
    metricName: breakdown.metricName ?? indicator.name,
    commitmentType,
    direction: readDirection(breakdown.direction),
    team: breakdown.team ?? "",
    osoProjectSlug: breakdown.osoProjectSlug ?? "",
    cadence,
    method: breakdown.method ?? "",
    slaStatement: breakdown.slaStatement ?? "",
    grantRef: breakdown.grantRef ?? null,
    unitOfMeasure: indicator.unitOfMeasure || null,
    source: sample?.source ?? null,
    proof: sample?.proof ?? null,
    thresholdOp: op,
    thresholdValue: value,
    series,
    // Growth counters are tracked for direction and never judged red, so they
    // must not move an SLA figure even once thresholds land.
    // No fallback bar is passed: each reading is judged against the threshold it
    // carried, so a bar signed today never scores last month retroactively.
    sla:
      commitmentType === "growth"
        ? { scored: 0, passed: 0, metPct: null }
        : computeSla(series, null, null, cadence),
    coverage: computeCoverage(series, cadence, windowDays),
    interruptions:
      commitmentType === "growth" ? [] : findInterruptions(series, null, null, cadence),
    latest: series.length > 0 ? (series[series.length - 1] ?? null) : null,
    projectUID,
  };
}

/* ------------------------------------------------------------------ */
/* Assembly                                                             */
/* ------------------------------------------------------------------ */

/**
 * One row per indicator. A commitment can surface more than once — two projects
 * report the same indicator, or one indicator hangs off two functions — so any
 * surface that COUNTS commitments must dedupe first. Every count on the page
 * goes through here, otherwise the inventory and the metrics tiles quote two
 * different totals for the same thing.
 */
export function uniqueCommitments(commitments: Commitment[]): Commitment[] {
  const seen = new Set<string>();
  const unique: Commitment[] = [];
  for (const commitment of commitments) {
    if (seen.has(commitment.indicatorId)) continue;
    seen.add(commitment.indicatorId);
    unique.push(commitment);
  }
  return unique;
}

/** The canonical "N commitments · X health · Y growth" figures. */
export function commitmentCounts(commitments: Commitment[]): {
  total: number;
  health: number;
  growth: number;
} {
  const unique = uniqueCommitments(commitments);
  const growth = unique.filter((commitment) => commitment.commitmentType === "growth").length;
  return { total: unique.length, health: unique.length - growth, growth };
}

export function assembleKernelData(
  overview: KernelOverviewResponse,
  functions: KernelFunctionApi[],
  projects: KernelProjectApi[],
  commitmentsByProject: Map<string, Commitment[]>,
): KernelData {
  const projectsByUid = new Map(projects.map((project) => [project.projectUID, project]));

  const projectEntries: ProjectEntry[] = projects.map((project) => ({
    ...project,
    declaredCommitments: project.commitments,
    commitments: commitmentsByProject.get(project.projectUID) ?? [],
  }));

  const byKernelId = new Map<string, Commitment[]>();
  for (const entry of projectEntries) {
    for (const commitment of entry.commitments) {
      const bucket = byKernelId.get(commitment.kernelId);
      if (bucket) bucket.push(commitment);
      else byKernelId.set(commitment.kernelId, [commitment]);
    }
  }

  const functionEntries: FunctionEntry[] = functions.map((fn) => {
    const commitments = byKernelId.get(fn.kernelId) ?? [];
    // Money and grant refs belong to the project, not the commitment, so they
    // are summed over distinct projects — a team reporting two metrics for one
    // function must not count its award twice.
    const contributingUids = new Set(commitments.map((c) => c.projectUID));
    let committedUsd = 0;
    const grantRefs = new Set<string>();
    for (const uid of contributingUids) {
      const project = projectsByUid.get(uid);
      if (!project) continue;
      committedUsd += project.committedUsd ?? 0;
      for (const ref of project.grantRefs ?? []) grantRefs.add(ref);
    }
    const teams = [...new Set(commitments.map((c) => c.team).filter(Boolean))].sort();
    return {
      ...fn,
      declaredCommitments: fn.commitments,
      commitments,
      teams,
      committedUsd,
      grantRefs: [...grantRefs].sort(),
    };
  });

  return {
    windowDays: overview.windowDays ?? WINDOW_DAYS,
    program: overview.program,
    tiers: overview.tiers ?? [],
    functions: functionEntries,
    projects: projectEntries,
    generatedAt: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* Per-render fetch                                                     */
/* ------------------------------------------------------------------ */

type EnvBag = { env?: Record<string, string | undefined> };

/**
 * `KERNEL_API_ORIGIN` must be set on the Vercel project (all environments) for
 * anything other than the public production API to be read.
 *
 * `process.env` is consulted first because it is the only one of the two that
 * exists at request time: Vite inlines `import.meta.env` at build, so on a
 * deployed function it carries whatever the build machine had, frozen. Reading
 * the live process environment first means a value changed in the Vercel
 * dashboard takes effect on the next invocation rather than the next build,
 * while the inlined value still covers `astro dev` and `astro build`, where
 * Astro loads `.env` into `import.meta.env` and not into `process.env`.
 */
function apiOrigin(): string {
  const fromNode = (globalThis as { process?: EnvBag }).process?.env?.KERNEL_API_ORIGIN;
  const fromAstro = import.meta.env?.KERNEL_API_ORIGIN as string | undefined;
  return (fromNode || fromAstro || DEFAULT_ORIGIN).replace(/\/+$/, "");
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    // Harmless against the real API, required against the ngrok dev tunnel.
    headers: { "ngrok-skip-browser-warning": "1", accept: "application/json" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${url}`);
  }
  return (await response.json()) as T;
}

/** A worker pool rather than Promise.all: 14 projects × 400 KB at once is rude. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      const item = items[index] as T;
      results[index] = await worker(item);
    }
  });
  await Promise.all(runners);
  return results;
}

/**
 * Deliberately a function the page awaits, not a module-scope constant.
 *
 * A top-level `await` here would resolve once per module instance, which on a
 * long-lived serverless instance means once per cold start — the same warm
 * instance would then answer every regeneration with the inventory it happened
 * to read first, and ISR's expiration would buy nothing. Calling it from the
 * frontmatter ties one read to one render.
 *
 * Also why nothing memoises the result: the cache that matters is Vercel's, in
 * front of the function, and it is the one with an expiration on it.
 */
export async function loadKernelData(): Promise<KernelData | null> {
  const origin = apiOrigin();
  const query = `?windowDays=${WINDOW_DAYS}`;
  try {
    const [overview, functionsBody, projectsBody] = await Promise.all([
      getJson<KernelOverviewResponse>(`${origin}/v2/kernel/overview${query}`),
      getJson<{ functions: KernelFunctionApi[] }>(`${origin}/v2/kernel/functions${query}`),
      getJson<{ projects: KernelProjectApi[] }>(`${origin}/v2/kernel/projects${query}`),
    ]);

    const functions = functionsBody.functions ?? [];
    const projects = projectsBody.projects ?? [];
    if (!overview?.program || functions.length === 0) {
      throw new Error("overview or functions came back empty");
    }

    const payloads = await mapWithConcurrency(
      projects,
      INDICATOR_CONCURRENCY,
      async (project) => {
        const body = await getJson<{ indicators: ProjectIndicator[] }>(
          `${origin}/v2/indicators/projects/${encodeURIComponent(project.projectUID)}`,
        );
        return { projectUID: project.projectUID, indicators: body.indicators ?? [] };
      },
    );

    // One window for the whole page, ending today, so every commitment is
    // measured against the same 90 days and a team that stopped reporting shows
    // the silence rather than a window that slid back with it.
    const referenceDate = buildDate();

    const perProject = payloads.map(
      (payload) =>
        [
          payload.projectUID,
          payload.indicators
            .map((indicator) =>
              buildCommitment(payload.projectUID, indicator, {
                windowDays: WINDOW_DAYS,
                referenceDate,
              }),
            )
            .filter((commitment): commitment is Commitment => commitment !== null),
        ] as const,
    );

    return assembleKernelData(overview, functions, projects, new Map(perProject));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(
      `[kernel] live inventory unavailable — rendering /kernel without it. Reason: ${reason}`,
    );
    return null;
  }
}
