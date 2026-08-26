import type { Commitment, Reading, ReadingPeriod } from "../../data/kernel-api";
import {
  WINDOW_DAYS,
  buildDate,
  coverageUnit,
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
  state: "met" | "missed" | "read" | "novalue" | "outage" | "none";
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
 * one of them was silent. `outage` sits just above it for the same reason in
 * reverse — a day our collector was down is a claim about us, and any
 * commitment that did produce a number that day outranks it.
 *
 * `read` outranks `met` because it is the less confident statement: a row
 * standing for several commitments where one was judged in-threshold and
 * another was only collected has not been judged, and must not inherit the
 * judged one's colour.
 */
const STATE_RANK: Record<PeriodState, number> = {
  none: 0,
  outage: 1,
  met: 2,
  read: 3,
  novalue: 4,
  missed: 5,
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
  read: 1,
  none: 2,
  outage: 3,
  novalue: 4,
  missed: 5,
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
 * A period that carried a reading is `read` unless a threshold was in force
 * when the reading was taken, in which case it is judged. `read` is the
 * ordinary case today and stays the ordinary case for any commitment whose
 * appendix is unsigned: the number exists, and the page says so and no more.
 *
 * `judgePeriod` is called with no fallback bar, exactly as `buildCommitment`
 * calls it for `sla` and `interruptions`: each reading is scored against the
 * threshold it carried, so a bar signed in August cannot retroactively grade
 * July. Passing the commitment-level threshold as a fallback here would judge
 * pre-threshold periods the headline SLA leaves unscored.
 */
function periodState(commitment: Commitment, period: ReadingPeriod): PeriodState {
  // A growth counter is tracked for direction and carries no bar, so it is
  // never judged — but it was still collected, which is what the bar shows.
  if (commitment.commitmentType === "growth") return "read";
  const met = judgePeriod(period, null, null);
  return met === null ? "read" : met ? "met" : "missed";
}

/** The same judgement one reading at a time, for the numbers table. */
function readingState(commitment: Commitment, reading: Reading): PeriodState {
  if (commitment.commitmentType === "growth") return "read";
  const met = judge(reading.value, reading.thresholdOp, reading.thresholdValue);
  return met === null ? "read" : met ? "met" : "missed";
}

/**
 * Why a day carries no value, from the collection record.
 *
 * `outageDates` is the subset of `noValueDates` the whole feed was blank on —
 * our own collector, not the source. It is excluded from the coverage
 * denominator upstream, so it is excluded from the strip's vocabulary too:
 * drawn as its own grey, never as a day the team failed to report.
 */
function absentState(commitment: Commitment, day: string): PeriodState {
  if (commitment.collection.outageDates.includes(day)) return "outage";
  if (commitment.collection.noValueDates.includes(day)) return "novalue";
  return "none";
}

/** The same question for a cadence period: the worst reason any day in it had. */
function absentStateForPeriod(
  commitment: Commitment,
  index: number,
  cadence: string,
): PeriodState {
  const first = dateOfPeriod(index, cadence);
  const span = cadenceDays(cadence);
  let state: PeriodState = "none";
  for (let offset = 0; offset < span; offset += 1) {
    state = worseInBucket(state, absentState(commitment, isoOfDay(dayIndex(first) + offset)));
  }
  return state;
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
 * `includeGrowth` is false for every rolled-up strip. A growth counter is never
 * judged, so since `read` outranks `met`, one counter in the set would hold a
 * whole function's row at "collected, not judged" over periods in which every
 * health commitment was judged and met. A counter that can never report an
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
      const filled = new Set<number>();
      for (const period of groupByPeriod(commitment.series, commitment.cadence)) {
        const state = periodState(commitment, period);
        for (const reading of period.readings) {
          const index = periodIndex(reading.date, gridCadence);
          if (index === null) continue;
          const slot = index - startIndex;
          if (slot >= 0 && slot < count) {
            filled.add(slot);
            states[slot] = worseAcrossCommitments(states[slot]!, state);
          }
        }
      }
      // A slot this commitment did not fill still carries a reason, and the
      // rollup keeps it: a row is only "no reading" when every commitment was
      // silent for a reason no better than silence.
      for (let slot = 0; slot < count; slot += 1) {
        if (filled.has(slot)) continue;
        const absent = absentStateForPeriod(commitment, startIndex + slot, gridCadence);
        if (absent === "none") continue;
        states[slot] = worseAcrossCommitments(states[slot]!, absent);
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
    ? (UNIT_NOUN[coverageUnit(gridCadence)] ?? "period")
    : "reading";

  return { periods, periodsPerBar, unit, sourceCount: active.length, growthOnly };
}

/**
 * One commitment's own bars, oldest last.
 *
 * The bars are the cadence partition — the same one the coverage fraction
 * counts — so "10 of 13 weeks read" and the strip beside it are the same claim
 * rather than two that happen to agree. The exception is a partition that
 * collapses to a single period: one bar is not a strip, and a monthly
 * commitment reporting nightly says far more through its readings than through
 * the one month they all land in.
 *
 * Either way this is the only entry point that will draw a growth counter,
 * because on its own block the "collected, never judged" record is the point.
 */
export function toPeriods(commitment: Commitment): Period[] {
  const byCadence = cadenceBars(commitment);
  return compress(byCadence.length >= 2 ? byCadence : readingBars(commitment));
}

type Bar = { date: string; state: PeriodState };

/**
 * Bars over the whole window, at the commitment's own cadence.
 *
 * The strip spans `WINDOW_DAYS` ending on the build date — the same window
 * every other figure on the page is computed over — and not the run of the
 * collector. Cropping to `collection.startedOn` made a commitment first read
 * four days ago look identical to one read all quarter, which is the single
 * most important thing this page has to say about itself right now: almost
 * nothing here has been watched for long.
 *
 * The coverage fraction beside it counts a shorter span on purpose — a source
 * cannot be backfilled to before anyone was watching it — so the bars before
 * the run are drawn and not counted, and `CommitmentBlock` says so under them.
 */
function cadenceBars(commitment: Commitment): Bar[] {
  const cadence = normalizeCadence(commitment.cadence);
  if (!CADENCES.includes(cadence as (typeof CADENCES)[number])) return [];

  const { start, end } = windowRange();
  const startIndex = periodIndex(start, cadence);
  const endIndex = periodIndex(end, cadence);
  if (startIndex === null || endIndex === null) return [];

  const states = new Map<number, PeriodState>();
  for (const period of groupByPeriod(commitment.series, commitment.cadence)) {
    if (period.index === null) continue;
    states.set(period.index, periodState(commitment, period));
  }

  // An absent period is drawn, never skipped, and says why it is absent: a day
  // our own collector was blank is excluded from the coverage denominator, and
  // a day the source produced no defensible number is not the same claim as a
  // day nobody looked.
  const bars: Bar[] = [];
  for (let index = startIndex; index <= endIndex; index += 1) {
    bars.push({
      date: dateOfPeriod(index, cadence),
      state: states.get(index) ?? absentStateForPeriod(commitment, index, cadence),
    });
  }
  return bars;
}

/**
 * One bar per row in the public table. Keeps the days a probe ran and produced
 * nothing: a feed that ran and got no defensible value is not a feed that was
 * silent, and only this axis is fine enough to show the difference.
 */
function readingBars(commitment: Commitment): Bar[] {
  const bars = new Map<string, PeriodState>();
  for (const period of groupByPeriod(commitment.series, commitment.cadence)) {
    const state = periodState(commitment, period);
    for (const reading of period.readings) {
      bars.set(reading.date.slice(0, 10), state);
    }
  }
  for (const day of commitment.collection.noValueDates) {
    if (!bars.has(day)) bars.set(day, absentState(commitment, day));
  }
  return [...bars.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, state]) => ({ date, state }));
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
  const byCadence = cadenceBars(commitment);
  const source = byCadence.length >= 2 ? byCadence : readingBars(commitment);
  if (source.length === 0) return "no readings in the window";

  const noun =
    byCadence.length >= 2
      ? (UNIT_NOUN[coverageUnit(commitment.cadence)] ?? "period")
      : "reading";
  const perBar = Math.max(1, Math.ceil(source.length / MAX_BARS));
  return perBar === 1
    ? `one bar = one ${noun}`
    : `one bar = ${perBar} ${noun}s`;
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
export type CollectionRow = {
  date: string;
  /** Null on a day the probe ran and produced nothing. */
  value: number | null;
  state: PeriodState;
  collection: "read" | "outage" | "no value";
};

/**
 * Every row the public table holds, newest first. Unlike `readingsInWindow`
 * this keeps the days that produced no value: a blank row is the only place a
 * reader can tell a collection outage from a value that was genuinely absent,
 * and dropping them would make an interrupted feed look like an unbroken one.
 */
export function collectionLog(commitment: Commitment): CollectionRow[] {
  const outages = new Set(commitment.collection.outageDates);
  const rows: CollectionRow[] = commitment.series.map((reading) => ({
    date: reading.date,
    value: reading.value,
    state: readingState(commitment, reading),
    collection: "read",
  }));
  for (const day of commitment.collection.noValueDates) {
    rows.push({
      date: day,
      value: null,
      state: outages.has(day) ? "outage" : "novalue",
      collection: outages.has(day) ? "outage" : "no value",
    });
  }
  return rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

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
