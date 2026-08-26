import type { Commitment, Reading, ReadingPeriod } from "../../data/kernel-api";
import {
  WINDOW_DAYS,
  buildDate,
  expectedPeriods,
  groupByPeriod,
  judge,
  judgePeriod,
  periodIndex,
} from "../../data/kernel-api";

/**
 * One rendered bar of an uptime strip. `date` is the first day the bar covers,
 * so a strip can label its own ends without the caller carrying the window.
 */
export type Period = {
  date: string;
  state: "met" | "missed" | "indeterminate" | "none";
};

export type PeriodState = Period["state"];

/**
 * A safety valve, not a design: at 96 the finest real cadence (daily, 90
 * periods) never compresses, so no bar has to stand for more than one reading
 * period. Compression erases absence — see `worseInBucket` — so the right
 * number of bars is "all of them", and the strip scrolls inside its own
 * container when the viewport cannot fit them.
 */
const MAX_BARS = 96;

const MS_PER_DAY = 86_400_000;

/**
 * Absent ranks lowest so any reading at all beats it: this combines *different
 * commitments* over the same period, and "no reading" is only true when every
 * one of them was silent.
 */
const STATE_RANK: Record<PeriodState, number> = {
  none: 0,
  met: 1,
  indeterminate: 2,
  missed: 3,
};

const worseAcrossCommitments = (a: PeriodState, b: PeriodState): PeriodState =>
  STATE_RANK[b] > STATE_RANK[a] ? b : a;

/**
 * Combining *periods* into one compressed bar is the opposite problem: a bar
 * covering one reading and one silence must not read as fully met, or a series
 * that alternates reading/gap would paint an unbroken green strip over 50%
 * coverage. So here absence outranks met — a bar can understate what was read,
 * never overstate it.
 */
const BUCKET_RANK: Record<PeriodState, number> = {
  met: 0,
  none: 1,
  indeterminate: 2,
  missed: 3,
};

const worseInBucket = (a: PeriodState, b: PeriodState): PeriodState =>
  BUCKET_RANK[b] > BUCKET_RANK[a] ? b : a;

/** Whole UTC days since the epoch. */
export const dayIndex = (iso: string): number =>
  Math.floor(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / MS_PER_DAY);

const isoOfDay = (day: number): string =>
  new Date(day * MS_PER_DAY).toISOString().slice(0, 10);

const shiftDays = (iso: string, days: number): string =>
  isoOfDay(dayIndex(iso) + days);

/**
 * The cadences the data layer can partition time by, finest first. Anything
 * else has no period axis at all (`periodIndex` returns null for it), and is
 * handled by falling back to one bar per reading.
 */
const CADENCES = ["daily", "weekly", "monthly"] as const;

const normalizeCadence = (cadence: string | null | undefined): string =>
  (cadence ?? "").trim().toLowerCase();

/** Days one period of this cadence spans. Used only for chart gap detection. */
export function cadenceDays(cadence: string | null | undefined): number {
  switch (normalizeCadence(cadence)) {
    case "weekly":
      return 7;
    case "monthly":
      return 30;
    default:
      return 1;
  }
}

const UNIT_NOUN: Record<string, string> = {
  days: "day",
  weeks: "week",
  months: "month",
  readings: "reading",
};

/** The first day of the period at `index` on the cadence's own axis. */
function dateOfPeriod(index: number, cadence: string): string {
  switch (normalizeCadence(cadence)) {
    case "weekly":
      // `periodIndex` counts ISO weeks from the Monday of epoch week 0, which
      // is day 4 (Monday 5 Jan 1970).
      return isoOfDay(index * 7 + 4);
    case "monthly":
      return new Date(Date.UTC(Math.floor(index / 12), index % 12, 1))
        .toISOString()
        .slice(0, 10);
    default:
      return isoOfDay(index);
  }
}

/**
 * The verdict of one cadence period, in the strip's vocabulary.
 *
 * `judgePeriod` is called with no fallback bar, exactly as `buildCommitment`
 * calls it for `sla` and `interruptions`: each reading is scored against the
 * threshold it carried, so a bar signed in August cannot retroactively grade
 * July. Passing the commitment-level threshold as a fallback here would colour
 * pre-threshold periods that the headline SLA counts as indeterminate.
 */
function periodState(commitment: Commitment, period: ReadingPeriod): PeriodState {
  // A growth counter has no bar and can never report an outage.
  if (commitment.commitmentType === "growth") return "indeterminate";
  const met = judgePeriod(period, null, null);
  return met === null ? "indeterminate" : met ? "met" : "missed";
}

/** The same judgement one reading at a time, for the numbers table. */
function readingState(commitment: Commitment, reading: Reading): PeriodState {
  if (commitment.commitmentType === "growth") return "indeterminate";
  const met = judge(reading.value, reading.thresholdOp, reading.thresholdValue);
  return met === null ? "indeterminate" : met ? "met" : "missed";
}

type Grid = {
  periods: Period[];
  /** Reading periods folded into one bar; 1 means a bar is one period. */
  periodsPerBar: number;
  /** "day" | "week" | "month" | "reading" — what one period is. */
  unit: string;
  /** How many commitments the bars actually speak for. */
  sourceCount: number;
  /**
   * Set when every commitment handed in was a growth counter and the rollup
   * therefore has nothing to draw — which is not the same as no readings.
   */
  growthOnly: boolean;
};

const EMPTY_GRID: Grid = {
  periods: [],
  periodsPerBar: 0,
  unit: "reading",
  sourceCount: 0,
  growthOnly: false,
};

/**
 * The window every derived figure on this page shares: `WINDOW_DAYS` ending on
 * the build date.
 *
 * Anchored on the build date, not on the freshest reading — the same choice
 * `buildCommitment` makes. A window that slid back with the data would hide a
 * stalled sync: coverage would say "63 of 90 days" while the strip beside it
 * showed an unbroken record ending at the last reading.
 */
function windowRange(): { start: string; end: string } {
  const end = buildDate();
  return { start: shiftDays(end, -(WINDOW_DAYS - 1)), end };
}

/**
 * The one place the strip's bars are computed — and it computes nothing about
 * time itself. The partition comes from the data layer (`groupByPeriod`,
 * `periodIndex`, `judgePeriod`, `expectedPeriods`), so the bars, the coverage
 * fraction and the SLA percentage are the same partition of the same window by
 * construction rather than by agreement.
 *
 * `includeGrowth` is false for every rolled-up strip. A growth counter has no
 * threshold, so its every reading is indeterminate — and since indeterminate
 * outranks met, one growth counter in the set would paint amber over periods
 * in which every health commitment was met. A counter that can never report an
 * outage must never colour a function's status, so the exclusion lives here
 * rather than in each caller.
 */
function buildGrid(
  commitments: Commitment[],
  { includeGrowth }: { includeGrowth: boolean },
): Grid {
  const eligible = includeGrowth
    ? commitments
    : commitments.filter((c) => c.commitmentType !== "growth");
  const growthOnly = commitments.length > 0 && eligible.length === 0;

  const active = eligible.filter((c) => c.series.length > 0);
  if (active.length === 0) {
    return { ...EMPTY_GRID, growthOnly };
  }

  const { start, end } = windowRange();

  // The finest cadence present sets the axis. Every commitment still keeps its
  // own cadence for judging: a monthly verdict is placed on the bars its own
  // readings fall in, never smeared across the month it covers.
  const gridCadence = CADENCES.find((cadence) =>
    active.some((c) => normalizeCadence(c.cadence) === cadence),
  );

  const bars: { date: string; state: PeriodState }[] = [];

  if (gridCadence) {
    const startIndex = periodIndex(start, gridCadence)!;
    const endIndex = periodIndex(end, gridCadence)!;
    const count = Math.max(1, endIndex - startIndex + 1);
    const states: PeriodState[] = new Array(count).fill("none");

    for (const commitment of active) {
      for (const period of groupByPeriod(commitment.series, commitment.cadence)) {
        const state = periodState(commitment, period);
        for (const reading of period.readings) {
          const index = periodIndex(reading.date, gridCadence);
          if (index === null) continue;
          const slot = index - startIndex;
          if (slot >= 0 && slot < count) {
            states[slot] = worseAcrossCommitments(states[slot]!, state);
          }
        }
      }
    }

    for (let i = 0; i < count; i += 1) {
      bars.push({ date: dateOfPeriod(startIndex + i, gridCadence), state: states[i]! });
    }

    /*
     * 90 days ending in August touch four calendar months, while the coverage
     * denominator is the promise the cadence makes — `ceil(90/30)` = 3. Drop
     * the oldest bars only while they are empty, so the strip never shows more
     * bars than the fraction beside it counts, and never hides a period that
     * fraction includes.
     */
    const { expected } = expectedPeriods(gridCadence, WINDOW_DAYS);
    while (expected !== null && bars.length > expected && bars[0]!.state === "none") {
      bars.shift();
    }
  } else {
    // No period axis for this cadence, so there is no such thing as an absent
    // period: one bar per reading, in date order, and nothing is inferred
    // about the silence between them.
    const byDate = new Map<string, PeriodState>();
    for (const commitment of active) {
      for (const period of groupByPeriod(commitment.series, commitment.cadence)) {
        const state = periodState(commitment, period);
        for (const reading of period.readings) {
          const at = reading.date.slice(0, 10);
          byDate.set(at, worseAcrossCommitments(byDate.get(at) ?? "none", state));
        }
      }
    }
    for (const [date, state] of [...byDate.entries()].sort()) {
      bars.push({ date, state });
    }
  }

  const periodsPerBar = Math.max(1, Math.ceil(bars.length / MAX_BARS));
  const periods: Period[] = [];
  for (let i = 0; i < bars.length; i += periodsPerBar) {
    let state: PeriodState = "met";
    for (let k = i; k < Math.min(i + periodsPerBar, bars.length); k += 1) {
      state = worseInBucket(state, bars[k]!.state);
    }
    periods.push({ date: bars[i]!.date, state: periodsPerBar === 1 ? bars[i]!.state : state });
  }

  const unit = gridCadence
    ? (UNIT_NOUN[expectedPeriods(gridCadence, WINDOW_DAYS).unit] ?? "period")
    : "reading";

  return { periods, periodsPerBar, unit, sourceCount: active.length, growthOnly };
}

/**
 * One bar per reading, oldest first — the uptime record of a single commitment.
 *
 * Not the cadence axis the rolled-up strips use: that would fold a monthly
 * commitment's daily rows into three bars, and the reader would lose both the
 * rhythm of the feed and the days a probe ran and came back with nothing. Those
 * attempts are drawn indeterminate rather than dropped, because a feed that ran
 * and got no defensible value is not a feed that was silent.
 *
 * This is also the only entry point that will draw a growth counter, because on
 * its own block the amber "tracked, never judged" record is the point.
 */
export function toPeriods(commitment: Commitment): Period[] {
  const bars = new Map<string, PeriodState>();
  for (const period of groupByPeriod(commitment.series, commitment.cadence)) {
    const state = periodState(commitment, period);
    for (const reading of period.readings) {
      bars.set(reading.date.slice(0, 10), state);
    }
  }
  for (const day of commitment.collection.noValueDates) {
    if (!bars.has(day)) bars.set(day, "indeterminate");
  }

  const ordered = [...bars.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, state]) => ({ date, state }));

  return compress(ordered);
}

/** Fold bars into MAX_BARS buckets, worst state winning. */
function compress(bars: { date: string; state: PeriodState }[]): Period[] {
  const perBar = Math.max(1, Math.ceil(bars.length / MAX_BARS));
  if (perBar === 1) return bars;
  const out: Period[] = [];
  for (let i = 0; i < bars.length; i += perBar) {
    let state: PeriodState = "met";
    for (let k = i; k < Math.min(i + perBar, bars.length); k += 1) {
      state = worseInBucket(state, bars[k]!.state);
    }
    out.push({ date: bars[i]!.date, state });
  }
  return out;
}

/**
 * One strip standing for several commitments: per period the worst state any
 * of them was in. A row is only "no reading" when every commitment is absent.
 * Growth counters are excluded — see `buildGrid`.
 */
export function worstOf(commitments: Commitment[]): Period[] {
  return buildGrid(commitments, { includeGrowth: false }).periods;
}

function describeBars(grid: Grid): string {
  return grid.periodsPerBar === 1
    ? `1 bar = 1 ${grid.unit}`
    : `1 bar = ${grid.periodsPerBar} ${grid.unit}s`;
}

/**
 * The caption for one commitment's own strip — the partner of `toPeriods`,
 * and so the one caption that describes a growth counter's bars instead of
 * excluding them.
 */
export function barCaptionFor(commitment: Commitment): string {
  const bars = toPeriods(commitment);
  if (bars.length === 0) return "no readings in the window";
  const readings = commitment.series.length + commitment.collection.noValueDates.length;
  const perBar = Math.max(1, Math.ceil(readings / MAX_BARS));
  return perBar === 1
    ? "one bar = one reading"
    : `one bar = ${perBar} readings`;
}

/**
 * e.g. `1 bar = 1 day · worst of 4`. Doubles as the empty-state line, so a
 * caller that passes both to `UptimeStrip` says the right thing when there is
 * no health record to draw.
 */
export function barCaption(commitments: Commitment[]): string {
  const grid = buildGrid(commitments, { includeGrowth: false });
  if (grid.growthOnly) return "growth counters only · no health record";
  if (grid.periods.length === 0) return "no readings in the window";

  const unit = describeBars(grid);
  return grid.sourceCount > 1 ? `${unit} · worst of ${grid.sourceCount}` : unit;
}

/**
 * The span the commitment's own bars cover, first reading to last. The bars are
 * one-per-reading, so labelling their ends with the rolling window would put a
 * date on the axis that no bar reaches — and the coverage fraction beside it
 * already carries how much of the promise went unread.
 */
export function windowOf(
  commitment: Commitment,
): { start: string; end: string } | null {
  const bars = toPeriods(commitment);
  const first = bars[0];
  const last = bars[bars.length - 1];
  if (!first || !last) return null;
  return { start: first.date, end: last.date };
}

/**
 * The readings behind the bars, newest first — the text equivalent of the
 * strip. The series is already windowed by the data layer, so this adds only
 * the per-reading verdict; a bar is a period, a row is a reading, and each is
 * judged against the bar that reading carried.
 */
export function readingsInWindow(
  commitment: Commitment,
): { date: string; value: number; state: PeriodState }[] {
  return commitment.series
    .map((reading) => ({
      date: reading.date,
      value: reading.value,
      state: readingState(commitment, reading),
    }))
    .reverse();
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** `2026-08-21` → `Aug 21`. Dates on this page are always inside one window. */
export function formatDay(iso: string): string {
  const day = dayIndex(iso);
  if (Number.isNaN(day)) return iso;
  const date = new Date(day * MS_PER_DAY);
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

/**
 * Readings arrive with ten decimal places. Trim to something a person can
 * compare at a glance without rounding a small value away to nothing.
 */
export function formatValue(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (Number.isInteger(value)) return String(value);
  const abs = Math.abs(value);
  const digits = abs >= 100 ? 0 : abs >= 1 ? 1 : 3;
  return String(Number(value.toFixed(digits)));
}

export function pluralize(count: number, singular: string): string {
  return count === 1 ? singular : `${singular}s`;
}
