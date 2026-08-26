import { describe, expect, it } from "vitest";

import {
  assembleKernelData,
  buildCommitment,
  commitmentCounts,
  computeCoverage,
  computeSla,
  expectedPeriods,
  findInterruptions,
  formatUsd,
  groupByPeriod,
  judge,
  judgePeriod,
  maxReadingDate,
  periodIndex,
  periodKey,
  uniqueCommitments,
  normalizeSeries,
  parseBreakdown,
  windowSeries,
  type IndicatorDatapoint,
  type KernelFunctionApi,
  type KernelOverviewResponse,
  type KernelProjectApi,
  type ProjectIndicator,
  type Reading,
} from "../kernel-api";

import functionsSample from "./fixtures/functions.json";
import indicatorsSample from "./fixtures/indicators-first.json";
import overviewSample from "./fixtures/overview.json";
import projectsSample from "./fixtures/projects.json";

const readings = (...pairs: [string, number][]): Reading[] =>
  pairs.map(([date, value]) => ({ date, value }));

describe("judge", () => {
  it("evaluates every recognised operator", () => {
    expect(judge(1, "<", 2)).toBe(true);
    expect(judge(3, "<", 2)).toBe(false);
    expect(judge(2, "<=", 2)).toBe(true);
    expect(judge(3, ">", 2)).toBe(true);
    expect(judge(2, ">=", 2)).toBe(true);
    expect(judge(2, "=", 2)).toBe(true);
    expect(judge(2, "==", 2)).toBe(true);
    expect(judge(3, "==", 2)).toBe(false);
  });

  it("returns null — not false — for an unrecognised operator", () => {
    expect(judge(1, "~=", 2)).toBeNull();
    expect(judge(1, "between", 2)).toBeNull();
  });

  it("returns null when no bar is in force", () => {
    expect(judge(1, null, null)).toBeNull();
    expect(judge(1, "<=", null)).toBeNull();
    expect(judge(1, null, 5)).toBeNull();
  });

  it("treats zero as a real value on both sides", () => {
    expect(judge(0, "<=", 5)).toBe(true);
    expect(judge(0, "=", 0)).toBe(true);
    expect(judge(0, ">", 0)).toBe(false);
    expect(judge(5, ">", 0)).toBe(true);
  });
});

describe("computeSla", () => {
  it("yields metPct null when nothing is judgeable", () => {
    const sla = computeSla(readings(["2026-08-01", 0], ["2026-08-02", 12]), null, null);
    expect(sla).toEqual({ scored: 0, passed: 0, metPct: null });
    expect(sla.metPct).not.toBe(0);
  });

  it("scores only judgeable readings", () => {
    const sla = computeSla(
      readings(["2026-08-01", 0], ["2026-08-02", 10], ["2026-08-03", 4]),
      "<=",
      5,
    );
    expect(sla).toEqual({ scored: 3, passed: 2, metPct: 66.7 });
  });

  it("counts a zero reading as met, never as missing", () => {
    const sla = computeSla(readings(["2026-08-01", 0], ["2026-08-02", 0]), "<=", 5);
    expect(sla).toEqual({ scored: 2, passed: 2, metPct: 100 });
  });

  it("reports 0% honestly when everything really did miss", () => {
    const sla = computeSla(readings(["2026-08-01", 9]), "<=", 5);
    expect(sla).toEqual({ scored: 1, passed: 0, metPct: 0 });
  });
});

describe("expectedPeriods / computeCoverage", () => {
  it("derives the denominator from the cadence", () => {
    expect(expectedPeriods("daily", 90)).toEqual({ expected: 90, unit: "days" });
    expect(expectedPeriods("weekly", 90)).toEqual({ expected: 13, unit: "weeks" });
    expect(expectedPeriods("monthly", 90)).toEqual({ expected: 3, unit: "months" });
    expect(expectedPeriods("Daily", 90)).toEqual({ expected: 90, unit: "days" });
  });

  it("falls back to a reading count for an unknown cadence", () => {
    expect(expectedPeriods("quarterly", 90)).toEqual({ expected: null, unit: "readings" });
    expect(expectedPeriods(null, 90)).toEqual({ expected: null, unit: "readings" });

    const coverage = computeCoverage(
      readings(["2026-08-01", 0], ["2026-08-15", 1]),
      "quarterly",
      90,
    );
    expect(coverage).toEqual({ read: 2, expected: 2, unit: "readings" });
  });

  it("counts readings present against the periods the cadence promised", () => {
    expect(computeCoverage(readings(["2026-08-01", 0]), "daily", 90)).toEqual({
      read: 1,
      expected: 90,
      unit: "days",
    });
    expect(
      computeCoverage(readings(["2026-06-30", 0], ["2026-07-31", 0], ["2026-08-31", 0]), "monthly", 90),
    ).toEqual({ read: 3, expected: 3, unit: "months" });
  });

  it("counts a zero reading as a reading", () => {
    expect(computeCoverage(readings(["2026-08-01", 0], ["2026-08-02", 0]), "daily", 90).read).toBe(2);
  });
});

describe("findInterruptions", () => {
  const op = "<=";
  const threshold = 5;

  it("returns nothing when there is no bar in force", () => {
    expect(findInterruptions(readings(["2026-08-01", 99]), null, null)).toEqual([]);
  });

  it("groups consecutive misses into one run", () => {
    const runs = findInterruptions(
      readings(
        ["2026-05-03", 0],
        ["2026-05-04", 9],
        ["2026-05-05", 9],
        ["2026-05-06", 9],
        ["2026-05-07", 0],
      ),
      op,
      threshold,
      "daily",
    );
    expect(runs).toEqual([{ startDate: "2026-05-04", length: 3 }]);
  });

  it("catches a run at the very start of the window", () => {
    const runs = findInterruptions(
      readings(["2026-05-01", 9], ["2026-05-02", 9], ["2026-05-03", 0]),
      op,
      threshold,
      "daily",
    );
    expect(runs).toEqual([{ startDate: "2026-05-01", length: 2 }]);
  });

  it("catches a run at the very end of the window", () => {
    const runs = findInterruptions(
      readings(["2026-05-01", 0], ["2026-05-02", 9], ["2026-05-03", 9]),
      op,
      threshold,
      "daily",
    );
    expect(runs).toEqual([{ startDate: "2026-05-02", length: 2 }]);
  });

  it("finds several separate runs", () => {
    const runs = findInterruptions(
      readings(
        ["2026-05-01", 9],
        ["2026-05-02", 0],
        ["2026-05-03", 9],
        ["2026-05-04", 9],
      ),
      op,
      threshold,
      "daily",
    );
    expect(runs).toEqual([
      { startDate: "2026-05-01", length: 1 },
      { startDate: "2026-05-03", length: 2 },
    ]);
  });

  it("never counts a zero reading as an interruption", () => {
    expect(findInterruptions(readings(["2026-05-01", 0], ["2026-05-02", 0]), op, threshold)).toEqual(
      [],
    );
  });
});

describe("periodKey / groupByPeriod", () => {
  it("buckets a date into the period its cadence judges", () => {
    expect(periodKey("2026-08-21", "daily")).toBe("2026-08-21");
    expect(periodKey("2026-08-21", "monthly")).toBe("2026-08");
    expect(periodKey("2026-08-21", "weekly")).toBe("2026-W34");
    expect(periodKey("2026-08-21", "quarterly")).toBeNull();
  });

  it("qualifies an ISO week by its ISO year so a year boundary cannot collide", () => {
    // Both days sit in ISO week 1 of 2026, on either side of New Year.
    expect(periodKey("2025-12-29", "weekly")).toBe("2026-W01");
    expect(periodKey("2026-01-04", "weekly")).toBe("2026-W01");
    expect(periodKey("2026-01-05", "weekly")).toBe("2026-W02");
  });

  it("collapses several readings in one period, and none in the next", () => {
    const periods = groupByPeriod(
      readings(["2026-07-30", 1], ["2026-08-14", 2], ["2026-08-21", 3]),
      "monthly",
    );
    expect(periods.map((period) => period.key)).toEqual(["2026-07", "2026-08"]);
    expect(periods[1]?.readings).toHaveLength(2);
  });

  it("treats every reading as its own period when the cadence is unknown", () => {
    expect(groupByPeriod(readings(["2026-08-20", 1], ["2026-08-21", 2]), null)).toHaveLength(2);
  });
});

describe("judgePeriod", () => {
  const period = (...values: number[]) => ({
    key: "2026-08",
    index: periodIndex("2026-08-01", "monthly"),
    readings: values.map((value, index) => ({ date: `2026-08-0${index + 1}`, value })),
  });

  it("takes the worst reading in the period, so a mid-period breach is not hidden", () => {
    expect(judgePeriod(period(0, 9, 0), "<=", 5)).toBe(false);
    expect(judgePeriod(period(0, 1, 5), "<=", 5)).toBe(true);
  });

  it("is unjudgeable when no reading in the period could be judged", () => {
    expect(judgePeriod(period(0, 9), null, null)).toBeNull();
  });
});

describe("interruptions only join adjacent periods", () => {
  const op = "<=";
  const threshold = 5;

  it("does not bridge a silent period between two misses", () => {
    // Jul 1 missed, Jul 2 reported nothing, Jul 3 missed: two outages, not a
    // two-day one — silence is missing data, never a continuing failure.
    const runs = findInterruptions(
      readings(["2026-07-01", 9], ["2026-07-03", 9]),
      op,
      threshold,
      "daily",
    );
    expect(runs).toEqual([
      { startDate: "2026-07-01", length: 1 },
      { startDate: "2026-07-03", length: 1 },
    ]);
  });

  it("joins genuinely consecutive misses into one run", () => {
    const runs = findInterruptions(
      readings(["2026-07-01", 9], ["2026-07-02", 9]),
      op,
      threshold,
      "daily",
    );
    expect(runs).toEqual([{ startDate: "2026-07-01", length: 2 }]);
  });

  it("handles gaps at the very start and the very end of the window", () => {
    const runs = findInterruptions(
      readings(
        ["2026-07-01", 9],
        // gap
        ["2026-07-04", 9],
        ["2026-07-05", 9],
        ["2026-07-06", 0],
        // gap
        ["2026-07-09", 9],
      ),
      op,
      threshold,
      "daily",
    );
    expect(runs).toEqual([
      { startDate: "2026-07-01", length: 1 },
      { startDate: "2026-07-04", length: 2 },
      { startDate: "2026-07-09", length: 1 },
    ]);
  });

  it("steps monthly and weekly axes one period at a time", () => {
    expect(periodIndex("2026-08-01", "monthly")! - periodIndex("2026-07-01", "monthly")!).toBe(1);
    expect(periodIndex("2026-08-24", "weekly")! - periodIndex("2026-08-17", "weekly")!).toBe(1);
    expect(periodIndex("2026-08-21", "quarterly")).toBeNull();

    // Two missed months either side of a silent one stay two interruptions.
    expect(
      findInterruptions(readings(["2026-06-10", 9], ["2026-08-10", 9]), op, threshold, "monthly"),
    ).toHaveLength(2);
  });

  it("never joins misses when the cadence is unknown", () => {
    expect(
      findInterruptions(readings(["2026-07-01", 9], ["2026-07-02", 9]), op, threshold, null),
    ).toEqual([
      { startDate: "2026-07-01", length: 1 },
      { startDate: "2026-07-02", length: 1 },
    ]);
  });
});

describe("thresholds are judged as of the reading, not retroactively", () => {
  it("leaves a reading taken before its bar was signed unjudgeable", () => {
    const series: Reading[] = [
      { date: "2026-07-31", value: 99, thresholdOp: null, thresholdValue: null },
      { date: "2026-08-01", value: 9, thresholdOp: "<=", thresholdValue: 5 },
      { date: "2026-08-02", value: 1, thresholdOp: "<=", thresholdValue: 5 },
    ];
    expect(computeSla(series, null, null, "daily")).toEqual({
      scored: 2,
      passed: 1,
      metPct: 50,
    });
    expect(findInterruptions(series, null, null, "daily")).toEqual([
      { startDate: "2026-08-01", length: 1 },
    ]);
  });

  it("carries each datapoint's own bar onto its reading", () => {
    const series = normalizeSeries([
      {
        id: "1",
        value: "9",
        breakdown: null,
        startDate: "2026-08-01T00:00:00.000Z",
        endDate: "2026-08-01T00:00:00.000Z",
        period: null,
        proof: null,
        thresholdOp: "<=",
        thresholdValue: 5,
        source: "auto",
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-01T00:00:00.000Z",
      },
    ]);
    expect(series[0]?.thresholdOp).toBe("<=");
    expect(series[0]?.thresholdValue).toBe(5);
  });
});

describe("cadence periods drive SLA and interruptions", () => {
  // Eight nightly readings against a monthly commitment: two periods, not eight.
  const monthly = readings(
    ["2026-07-14", 0],
    ["2026-07-21", 9],
    ["2026-07-28", 0],
    ["2026-08-14", 0],
    ["2026-08-21", 0],
  );

  it("scores periods, not reading days", () => {
    expect(computeSla(monthly, "<=", 5, "monthly")).toEqual({
      scored: 2,
      passed: 1,
      metPct: 50,
    });
  });

  it("counts an interruption once per missed period", () => {
    expect(findInterruptions(monthly, "<=", 5, "monthly")).toEqual([
      { startDate: "2026-07-14", length: 1 },
    ]);
  });

  it("keeps per-reading scoring when no cadence is supplied", () => {
    expect(computeSla(monthly, "<=", 5).scored).toBe(5);
  });
});

describe("formatUsd", () => {
  it("rounds to a readable magnitude", () => {
    expect(formatUsd(1_480_000)).toBe("$1.48M");
    expect(formatUsd(2_132_267)).toBe("$2.13M");
    expect(formatUsd(2_000_000)).toBe("$2M");
    expect(formatUsd(213_000)).toBe("$213k");
    expect(formatUsd(5_000)).toBe("$5k");
    expect(formatUsd(106_867)).toBe("$107k");
    expect(formatUsd(750)).toBe("$750");
  });

  it("signals no award instead of rendering $0", () => {
    expect(formatUsd(0)).toBeNull();
    expect(formatUsd(null)).toBeNull();
    expect(formatUsd(undefined)).toBeNull();
  });
});

describe("parseBreakdown", () => {
  it("parses the real JSON string shape", () => {
    const raw = indicatorsSample.indicators[0]?.datapoints[0]?.breakdown ?? null;
    const parsed = parseBreakdown(raw);
    expect(parsed?.kernelId).toBe("randomness-relays");
    expect(parsed?.commitmentType).toBe("health");
    expect(parsed?.cadence).toBe("monthly");
  });

  it("survives malformed, empty and non-object payloads", () => {
    expect(parseBreakdown("{not json")).toBeNull();
    expect(parseBreakdown("")).toBeNull();
    expect(parseBreakdown(null)).toBeNull();
    expect(parseBreakdown("[1,2]")).toBeNull();
    expect(parseBreakdown("42")).toBeNull();
  });
});

describe("normalizeSeries / windowSeries", () => {
  const datapoint = (endDate: string, value: string): IndicatorDatapoint => ({
    id: endDate,
    value,
    breakdown: null,
    startDate: endDate,
    endDate,
    period: null,
    proof: null,
    thresholdOp: null,
    thresholdValue: null,
    source: "auto",
    createdAt: endDate,
    updatedAt: endDate,
  });

  it("parses string values, sorts ascending and de-duplicates by date", () => {
    const series = normalizeSeries([
      datapoint("2026-08-03T00:00:00.000Z", "39.8989931"),
      datapoint("2026-08-01T00:00:00.000Z", "0"),
      datapoint("2026-08-03T00:00:00.000Z", "12"),
    ]);
    expect(series.map(({ date, value }) => ({ date, value }))).toEqual([
      { date: "2026-08-01", value: 0 },
      { date: "2026-08-03", value: 12 },
    ]);
  });

  it("keeps zero readings and drops non-numeric ones", () => {
    const series = normalizeSeries([
      datapoint("2026-08-01T00:00:00.000Z", "0"),
      datapoint("2026-08-02T00:00:00.000Z", "n/a"),
      datapoint("2026-08-03T00:00:00.000Z", ""),
    ]);
    expect(series.map(({ date, value }) => ({ date, value }))).toEqual([
      { date: "2026-08-01", value: 0 },
    ]);
  });

  it("cuts the window against the freshest reading, not today", () => {
    const series = readings(
      ["2025-01-01", 1],
      ["2026-05-23", 2],
      ["2026-05-24", 3],
      ["2026-08-21", 4],
    );
    // Exactly 90 days inclusive of the reference day, so daily coverage can
    // never report 91 of 90.
    expect(windowSeries(series, 90, "2026-08-21")).toEqual([
      { date: "2026-05-24", value: 3 },
      { date: "2026-08-21", value: 4 },
    ]);
    expect(windowSeries(readings(["2026-05-24", 1]), 90, "2026-08-21")).toHaveLength(1);
    expect(windowSeries(readings(["2026-05-23", 1]), 90, "2026-08-21")).toHaveLength(0);
  });
});

describe("buildCommitment against the captured payload", () => {
  const project = indicatorsSample as unknown as {
    projectUID: string;
    indicators: ProjectIndicator[];
  };

  it("derives an unscored commitment from real datapoints", () => {
    const indicator = project.indicators.find(
      (candidate) => candidate.name === "drand-release-cadence",
    );
    expect(indicator).toBeDefined();

    const commitment = buildCommitment(project.projectUID, indicator as ProjectIndicator, {
      referenceDate: "2026-08-21",
    });
    expect(commitment).not.toBeNull();
    expect(commitment?.kernelId).toBe("randomness-relays");
    expect(commitment?.commitmentType).toBe("health");
    expect(commitment?.direction).toBe("lower_better");
    expect(commitment?.team).toBe("randamu");
    expect(commitment?.cadence).toBe("monthly");
    expect(commitment?.coverage.unit).toBe("months");
    // One month, not three: the denominator starts when the nightly run did.
    expect(commitment?.coverage.expected).toBe(1);
    // No threshold is signed upstream yet, so nothing is judgeable.
    expect(commitment?.sla).toEqual({ scored: 0, passed: 0, metPct: null });
    expect(commitment?.interruptions).toEqual([]);
    expect(commitment?.latest?.date).toBe("2026-08-21");
  });

  it("windows a long daily series down to the rolling period", () => {
    const indicator = project.indicators.find(
      (candidate) => candidate.name === "drand-relay-statuspage",
    ) as ProjectIndicator;
    expect(indicator.datapoints.length).toBeGreaterThan(90);

    const commitment = buildCommitment(project.projectUID, indicator, {
      referenceDate: maxReadingDate([indicator]),
    });
    expect(commitment?.series.length).toBeLessThanOrEqual(91);
    expect(commitment?.direction).toBe("status");
  });

  it("skips an indicator whose breakdown cannot be parsed", () => {
    const broken: ProjectIndicator = {
      id: "broken",
      name: "broken-indicator",
      description: "",
      unitOfMeasure: "",
      kernelId: null,
      hasData: true,
      lastUpdatedAt: null,
      datapoints: [
        {
          id: "1",
          value: "0",
          breakdown: "{oops",
          startDate: "2026-08-21T00:00:00.000Z",
          endDate: "2026-08-21T00:00:00.000Z",
          period: null,
          proof: null,
          thresholdOp: null,
          thresholdValue: null,
          source: "auto",
          createdAt: "2026-08-21T00:00:00.000Z",
          updatedAt: "2026-08-21T00:00:00.000Z",
        },
      ],
    };
    expect(buildCommitment("0xabc", broken)).toBeNull();
  });
});

describe("coverage against the captured slate", () => {
  const payloads = Object.values(
    import.meta.glob<{ projectUID: string; indicators: ProjectIndicator[] }>(
      "./fixtures/ind/*.json",
      { eager: true, import: "default" },
    ),
  );

  /**
   * The day the fixtures were captured plus three, so the tests exercise the
   * production anchor (the build date) with a sync that has gone quiet.
   */
  const referenceDate = "2026-08-24";

  const freshestReading = payloads
    .map((payload) => maxReadingDate(payload.indicators))
    .filter((day): day is string => day !== null)
    .sort()
    .at(-1) as string;

  const commitments = payloads.flatMap((payload) =>
    payload.indicators
      .map((indicator) => buildCommitment(payload.projectUID, indicator, { referenceDate }))
      .filter((commitment) => commitment !== null),
  );

  const byFunctionId = (functionId: string) =>
    commitments.find((commitment) => commitment.functionId === functionId);

  it("captured the whole slate", () => {
    expect(payloads).toHaveLength(14);
    expect(commitments).toHaveLength(37);
    expect(freshestReading).toBe("2026-08-21");
  });

  it("quotes one commitment count, deduped by indicator", () => {
    // 37 rows, but three indicators are reported twice across the slate — the
    // inventory and the metrics tiles must both say 34.
    expect(uniqueCommitments(commitments)).toHaveLength(34);
    expect(commitmentCounts(commitments)).toEqual({ total: 34, health: 29, growth: 5 });
  });

  it("shows a stalled sync as missing days rather than hiding it", () => {
    // Nothing has reported since the 21st; anchoring on the build date means
    // those three days are absent from coverage instead of being anchored away.
    const payload = payloads.find((candidate) =>
      candidate.indicators.some((indicator) => indicator.name === "drand-relay-statuspage"),
    )!;
    const indicator = payload.indicators.find(
      (candidate) => candidate.name === "drand-relay-statuspage",
    )!;

    const anchoredOnBuild = buildCommitment(payload.projectUID, indicator, { referenceDate })!;
    const anchoredOnData = buildCommitment(payload.projectUID, indicator, {
      referenceDate: freshestReading,
    })!;

    expect(anchoredOnBuild.latest?.date).toBe("2026-08-21");
    expect(anchoredOnBuild.coverage.read).toBe(anchoredOnData.coverage.read - 3);
  });

  it("counts months, not nightly readings, for a monthly commitment", () => {
    // Eight readings, all inside August — one month, read once.
    const release = byFunctionId("drand-release-cadence");
    expect(release?.cadence).toBe("monthly");
    expect(release?.series.length).toBe(8);
    expect(release?.coverage).toEqual({ read: 1, expected: 1, unit: "months" });

    const curio = byFunctionId("curio-sealing-release-cadence");
    expect(curio?.coverage).toEqual({ read: 1, expected: 1, unit: "months" });
  });

  it("does not let a review reading stretch the denominator", () => {
    // Nine rows, but the oldest was taken while someone was looking: counting
    // from it would bill this commitment for the months before anyone was
    // collecting, and print "2 of 3 months" for an unbroken record.
    const forest = byFunctionId("forest-release-cadence");
    expect(forest?.collection.rows).toBe(9);
    expect(forest?.collection.review).toBe(1);
    expect(forest?.collection.startedOn).toBe("2026-08-14");
    expect(forest?.coverage).toEqual({ read: 1, expected: 1, unit: "months" });
  });

  it("counts ISO weeks for a weekly commitment", () => {
    const docs = byFunctionId("network-documentation-commit-recency");
    expect(docs?.cadence).toBe("weekly");
    // Sixteen readings, but they land in only ten of the thirteen weeks the
    // window expects — before the fix this printed "16 of 13 weeks read".
    expect(docs?.series.length).toBe(16);
    expect(docs?.coverage).toEqual({ read: 10, expected: 13, unit: "weeks" });
  });

  it("never reads more periods than the window expects", () => {
    for (const commitment of commitments) {
      expect(
        commitment.coverage.read,
        `${commitment.functionId} (${commitment.cadence || "no cadence"})`,
      ).toBeLessThanOrEqual(commitment.coverage.expected);
      expect(commitment.coverage.read).toBeGreaterThanOrEqual(0);
    }
  });

  it("tops daily coverage out at the window length, never past it", () => {
    const daily = commitments.filter((commitment) => commitment.cadence === "daily");
    expect(daily.length).toBeGreaterThan(0);
    for (const commitment of daily) {
      expect(commitment.coverage.expected).toBeLessThanOrEqual(90);
      expect(commitment.coverage.expected).toBeGreaterThan(0);
      expect(commitment.series.length).toBeLessThanOrEqual(90);
    }

    // A source collected for over a year is capped by the window; one that
    // started this month is bounded by its own run instead.
    expect(byFunctionId("drand-relay-statuspage")?.coverage).toEqual({
      read: 63,
      expected: 90,
      unit: "days",
    });
    expect(byFunctionId("bootstrap-dns-mainnet")?.coverage).toEqual({
      read: 8,
      expected: 11,
      unit: "days",
    });
  });

  it("agrees with the API's own commitment count once deduped", () => {
    const data = assembleKernelData(
      overviewSample as unknown as KernelOverviewResponse,
      (functionsSample as unknown as { functions: KernelFunctionApi[] }).functions,
      (projectsSample as unknown as { projects: KernelProjectApi[] }).projects,
      new Map(
        payloads.map((payload) => [
          payload.projectUID,
          payload.indicators
            .map((indicator) =>
              buildCommitment(payload.projectUID, indicator, { referenceDate }),
            )
            .filter((commitment) => commitment !== null),
        ]),
      ),
    );

    // Three indicators are reported by two projects each, so the raw rows
    // overcount: chain-sync-state holds 10 rows for 7 commitments. Deduped, the
    // page's own count matches the rollup the API computed independently.
    const chainSync = data.functions.find((fn) => fn.kernelId === "chain-sync-state");
    expect(chainSync?.commitments).toHaveLength(10);
    expect(commitmentCounts(chainSync!.commitments).total).toBe(chainSync?.declaredCommitments);

    // Deduped, the page can never claim more commitments than the API counted.
    // It can claim fewer: `mainnet-explorer` declares two, and only one of them
    // is reachable through the projects the slate returns.
    for (const fn of data.functions) {
      expect(
        commitmentCounts(fn.commitments).total,
        fn.kernelId,
      ).toBeLessThanOrEqual(fn.declaredCommitments);
    }
    const explorer = data.functions.find((fn) => fn.kernelId === "mainnet-explorer");
    expect(commitmentCounts(explorer!.commitments).total).toBe(1);
    expect(explorer?.declaredCommitments).toBe(2);
  });

  it("leaves every SLA unjudged while no threshold is signed", () => {
    for (const commitment of commitments) {
      expect(commitment.sla.metPct).toBeNull();
      expect(commitment.interruptions).toEqual([]);
    }
  });
});

describe("assembleKernelData", () => {
  const overview = overviewSample as unknown as KernelOverviewResponse;
  const functions = (functionsSample as unknown as { functions: KernelFunctionApi[] }).functions;
  const projects = (projectsSample as unknown as { projects: KernelProjectApi[] }).projects;

  it("joins commitments onto functions without double-counting a project's award", () => {
    const sampleProject = projects[0] as KernelProjectApi;
    const indicators = (indicatorsSample as unknown as { indicators: ProjectIndicator[] })
      .indicators;
    const commitments = indicators
      .map((indicator) =>
        buildCommitment(sampleProject.projectUID, indicator, { referenceDate: "2026-08-21" }),
      )
      .filter((commitment) => commitment !== null);

    const data = assembleKernelData(
      overview,
      functions,
      projects,
      new Map([[sampleProject.projectUID, commitments]]),
    );

    const relays = data.functions.find((fn) => fn.kernelId === "randomness-relays");
    expect(relays).toBeDefined();
    // Three commitments on this function all come from one project, so its
    // award is counted once.
    expect(relays!.commitments.length).toBeGreaterThan(1);
    expect(relays!.committedUsd).toBe(sampleProject.committedUsd);
    expect(relays!.teams).toEqual(["randamu"]);
    expect(relays!.grantRefs).toEqual(sampleProject.grantRefs);

    // Unmeasured functions survive the join with an empty, honest shape.
    const unmeasured = data.functions.find((fn) => fn.commitments.length === 0);
    expect(unmeasured?.committedUsd).toBe(0);
    expect(unmeasured?.grantRefs).toEqual([]);
    expect(data.functions.length).toBe(functions.length);
    expect(data.projects.length).toBe(projects.length);
    expect(data.tiers.length).toBe(4);
  });
});
