import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  UNKNOWN_COLLECTION,
  WINDOW_DAYS,
  type Commitment,
  type Reading,
} from "../../../data/kernel-api";
import { collectionLog, toPeriods, worstOf, type Period } from "../uptime";

/** The window ends on the build date, so every case here fixes "today". */
const TODAY = "2026-08-26";

const day = (offset: number): string =>
  new Date(Date.parse(`${TODAY}T00:00:00Z`) + offset * 86_400_000)
    .toISOString()
    .slice(0, 10);

type Overrides = Partial<Omit<Commitment, "collection">> & {
  collection?: Partial<Commitment["collection"]>;
};

const commitment = (overrides: Overrides = {}): Commitment => ({
  functionId: "fn",
  indicatorId: "ind",
  kernelId: "kernel",
  metricName: "metric",
  commitmentType: "health",
  direction: "higher_better",
  team: "team",
  osoProjectSlug: "slug",
  cadence: "daily",
  method: "",
  slaStatement: "",
  grantRef: null,
  unitOfMeasure: null,
  source: null,
  proof: null,
  thresholdOp: null,
  thresholdValue: null,
  series: [],
  sla: { scored: 0, passed: 0, metPct: null },
  coverage: { read: 0, expected: 0, unit: "days" },
  changePct: null,
  interruptions: [],
  latest: null,
  projectUID: "uid",
  ...overrides,
  collection: { ...UNKNOWN_COLLECTION, ...overrides.collection },
});

const reading = (
  date: string,
  value: number,
  threshold?: { op: string; value: number },
): Reading => ({
  date,
  value,
  thresholdOp: threshold?.op ?? null,
  thresholdValue: threshold?.value ?? null,
});

const stateOn = (periods: Period[], date: string) =>
  periods.find((period) => period.date === date)?.state;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("toPeriods", () => {
  it("spans the whole window however short the run is", () => {
    const periods = toPeriods(
      commitment({
        series: [reading(day(-1), 10), reading(day(0), 12)],
        collection: { startedOn: day(-1) },
      }),
    );

    // Two days of readings, ninety days of record: cropping to the run is what
    // made a commitment first read yesterday look like one read all quarter.
    expect(periods).toHaveLength(WINDOW_DAYS);
    expect(periods[0]!.date).toBe(day(-(WINDOW_DAYS - 1)));
    expect(periods[periods.length - 1]!.date).toBe(TODAY);
  });

  it("keeps a reading unjudged while no threshold was in force", () => {
    const periods = toPeriods(commitment({ series: [reading(day(0), 4684)] }));

    expect(stateOn(periods, day(0))).toBe("read");
  });

  it("judges a reading that carried a threshold", () => {
    const periods = toPeriods(
      commitment({
        series: [
          reading(day(-1), 5, { op: "<=", value: 10 }),
          reading(day(0), 50, { op: "<=", value: 10 }),
        ],
      }),
    );

    expect(stateOn(periods, day(-1))).toBe("met");
    expect(stateOn(periods, day(0))).toBe("missed");
  });

  it("collects a growth counter rather than leaving it unmeasured", () => {
    const periods = toPeriods(
      commitment({ commitmentType: "growth", series: [reading(day(0), 900)] }),
    );

    expect(stateOn(periods, day(0))).toBe("read");
  });

  it("tells our own outage apart from a silent source", () => {
    const periods = toPeriods(
      commitment({
        series: [reading(day(-3), 1)],
        collection: {
          startedOn: day(-3),
          noValueDates: [day(-2), day(-1)],
          outageDates: [day(-1)],
        },
      }),
    );

    // -2 is the source: the probe ran and had nothing defensible to give.
    // -1 is us: the whole feed was blank, and coverage drops it outright.
    expect(stateOn(periods, day(-3))).toBe("read");
    expect(stateOn(periods, day(-2))).toBe("novalue");
    expect(stateOn(periods, day(-1))).toBe("outage");
    expect(stateOn(periods, day(-10))).toBe("none");
  });
});

describe("worstOf", () => {
  it("does not let a judged commitment speak for an unjudged one", () => {
    const periods = worstOf([
      commitment({ series: [reading(day(0), 5, { op: "<=", value: 10 })] }),
      commitment({ series: [reading(day(0), 4684)] }),
    ]);

    // One was in threshold, the other has no threshold at all. The row has not
    // been judged and must not inherit the judged one's verdict.
    expect(stateOn(periods, day(0))).toBe("read");
  });

  it("is only silent when every commitment was", () => {
    const periods = worstOf([
      commitment({ series: [reading(day(0), 1)] }),
      commitment({ series: [] }),
    ]);

    expect(stateOn(periods, day(0))).toBe("read");
  });
});

describe("collectionLog", () => {
  it("keeps the reason a row carries no value", () => {
    const rows = collectionLog(
      commitment({
        series: [reading(day(-2), 7)],
        collection: {
          noValueDates: [day(-1), day(0)],
          outageDates: [day(0)],
        },
      }),
    );

    expect(rows.map((row) => [row.date, row.state, row.collection])).toEqual([
      [day(0), "outage", "outage"],
      [day(-1), "novalue", "no value"],
      [day(-2), "read", "read"],
    ]);
  });
});
