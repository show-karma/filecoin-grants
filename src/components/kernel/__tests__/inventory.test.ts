import { describe, expect, it } from "vitest";

import { UNKNOWN_COLLECTION, type Commitment } from "../../../data/kernel-api";
import {
  collectionStatus,
  daysSilent,
  promisedIntervalDays,
} from "../inventory";

const ASOF = "2026-09-02";

const day = (offset: number): string =>
  new Date(Date.parse(`${ASOF}T00:00:00Z`) + offset * 86_400_000)
    .toISOString()
    .slice(0, 10);

const commitment = (
  overrides: Partial<Commitment> & { lastReading?: string | null } = {},
): Commitment => {
  const { lastReading, ...rest } = overrides;
  return {
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
    collection: UNKNOWN_COLLECTION,
    changePct: null,
    interruptions: [],
    latest: lastReading ? { date: lastReading, value: 1 } : null,
    projectUID: "uid",
    ...rest,
  };
};

describe("daysSilent", () => {
  it("should_measure_against_the_freshest_reading_not_today", () => {
    const rows = [commitment({ lastReading: day(-1) })];

    expect(daysSilent(rows, ASOF)).toBe(1);
  });

  it("should_take_the_newest_reading_across_the_rows_commitments", () => {
    const rows = [
      commitment({ lastReading: day(-9) }),
      commitment({ lastReading: day(-2) }),
    ];

    expect(daysSilent(rows, ASOF)).toBe(2);
  });

  it("should_report_null_when_nothing_has_ever_reported", () => {
    expect(daysSilent([commitment()], ASOF)).toBeNull();
  });
});

describe("promisedIntervalDays", () => {
  it("should_take_the_finest_cadence_present", () => {
    const rows = [
      commitment({ cadence: "monthly" }),
      commitment({ cadence: "daily" }),
    ];

    expect(promisedIntervalDays(rows)).toBe(1);
  });
});

describe("collectionStatus", () => {
  it("should_stay_collecting_while_the_row_is_within_its_promised_interval", () => {
    const rows = [commitment({ cadence: "daily", lastReading: day(-1) })];

    expect(collectionStatus(rows, ASOF)).toBe("collecting");
  });

  it("should_go_silent_once_a_daily_row_misses_more_than_a_day", () => {
    const rows = [commitment({ cadence: "daily", lastReading: day(-3) })];

    expect(collectionStatus(rows, ASOF)).toBe("silent");
  });

  it("should_not_call_a_monthly_row_silent_for_a_gap_a_daily_one_would_fail", () => {
    const rows = [commitment({ cadence: "monthly", lastReading: day(-6) })];

    expect(collectionStatus(rows, ASOF)).toBe("collecting");
  });

  it("should_report_never_when_the_row_has_no_reading_at_all", () => {
    expect(collectionStatus([commitment()], ASOF)).toBe("never");
  });
});
