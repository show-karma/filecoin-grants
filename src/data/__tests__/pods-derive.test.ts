import { fillNote } from "../pods-copy";
import { describe, expect, it } from "vitest";

import {
  changeOverWindow,
  formatUsd,
  openBookUsd,
  progressBarPct,
  progressPct,
  weightedBookUsd,
  withinCeiling,
  type PodMetric,
  type PodPipeline,
  type PodPipelineStage,
} from "../pods-api";

const metric = (overrides: Partial<PodMetric> = {}): PodMetric => ({
  metricKey: "filecoin_pay_arr",
  metricLabel: "Filecoin Pay ARR",
  target: 250_000,
  direction: "higher_better",
  unit: "USD",
  series: [
    { date: "2026-08-12", value: 10_000 },
    { date: "2026-09-09", value: 99_500 },
  ],
  ...overrides,
});

const stage = (
  overrides: Partial<PodPipelineStage> = {},
): PodPipelineStage => ({
  stage: "Prospect",
  stageOrder: 1,
  stageKind: "open",
  isFolded: false,
  entityCount: 11,
  amountUsd: 12_700_000,
  weightedUsd: 1_300_000,
  pb: 212,
  ...overrides,
});

const pipeline = (stages: PodPipelineStage[]): PodPipeline => ({
  entityKind: "deal",
  snapshotDate: "2026-09-29",
  totalEntities: 22,
  openEntities: 22,
  closedLostEntities: 0,
  dataActivityLabel: null,
  stages,
});

describe("formatUsd", () => {
  it.each([
    [1_808_864, "$1.8M"],
    [715_876, "$716K"],
    [601, "$601"],
  ])("should_scale_%s_to_%s", (amount, expected) => {
    expect(formatUsd(amount)).toBe(expected);
  });

  it("should_return_null_rather_than_zero_dollars", () => {
    // "$0" reads as a decision. Nothing recorded is an absence.
    expect(formatUsd(0)).toBeNull();
    expect(formatUsd(null)).toBeNull();
  });
});

describe("progressPct", () => {
  it("should_score_a_reading_against_a_target_it_climbs_toward", () => {
    expect(progressPct(metric())).toBeCloseTo(39.8);
  });

  it("should_refuse_to_score_a_ceiling", () => {
    // 1.69 against a 5-minute ceiling is 34% by the same arithmetic, which
    // would rank a pod worst exactly when it is furthest under the limit.
    expect(
      progressPct(
        metric({
          direction: "lower_better",
          target: 5,
          series: [{ date: "2026-09-09", value: 1.69 }],
        }),
      ),
    ).toBeNull();
  });

  it("should_refuse_to_score_when_upstream_states_no_direction", () => {
    expect(progressPct(metric({ direction: null }))).toBeNull();
  });

  it("should_state_the_real_share_once_the_target_is_passed", () => {
    // Beating a commitment is a result. LDO cleared its pool-capacity target
    // outright, and reporting that as 100% would hide the one goal it beat.
    expect(
      progressPct(metric({ series: [{ date: "2026-09-09", value: 400_000 }] })),
    ).toBe(160);
  });
});

describe("progressBarPct", () => {
  it("should_clamp_to_what_a_bar_can_draw", () => {
    expect(
      progressBarPct(
        metric({ series: [{ date: "2026-09-09", value: 400_000 }] }),
      ),
    ).toBe(100);
  });

  it("should_track_the_share_while_it_is_under_the_target", () => {
    expect(
      progressBarPct(
        metric({ series: [{ date: "2026-09-09", value: 125_000 }] }),
      ),
    ).toBe(50);
  });

  it("should_stay_unscored_where_the_share_is", () => {
    expect(progressBarPct(metric({ direction: null }))).toBeNull();
  });
});

describe("withinCeiling", () => {
  it.each([
    [1.69, true],
    [5, true],
    [6.2, false],
  ])("should_place_%s_against_a_5_minute_ceiling", (value, expected) => {
    expect(
      withinCeiling(
        metric({
          direction: "lower_better",
          target: 5,
          series: [{ date: "2026-09-09", value }],
        }),
      ),
    ).toBe(expected);
  });

  it("should_return_null_for_a_target_the_reading_climbs_toward", () => {
    expect(withinCeiling(metric())).toBeNull();
  });
});

describe("changeOverWindow", () => {
  it("should_measure_from_the_freshest_reading_not_from_today", () => {
    // The pods report fortnightly. Measured from now, a pod would read flat
    // for every week it is not due to report.
    expect(changeOverWindow(metric())).toBe(89_500);
  });

  it("should_report_null_when_the_series_does_not_reach_back_that_far", () => {
    expect(
      changeOverWindow(
        metric({ series: [{ date: "2026-09-09", value: 99_500 }] }),
      ),
    ).toBeNull();
  });
});

describe("openBookUsd", () => {
  it("should_sum_only_the_stages_still_open", () => {
    expect(
      openBookUsd(
        pipeline([
          stage(),
          stage({
            stage: "Closed/Dead",
            stageKind: "lost",
            amountUsd: 9_000_000,
          }),
        ]),
      ),
    ).toBe(12_700_000);
  });

  it("should_return_null_for_a_funnel_that_carries_no_value", () => {
    // A partnership tracker records neither a deal size nor a probability, so
    // there is no book to total — and none to add to the other pod's.
    expect(
      openBookUsd(
        pipeline([stage({ amountUsd: null, weightedUsd: null, pb: null })]),
      ),
    ).toBeNull();
  });

  it("should_weight_the_open_book_by_its_own_probabilities", () => {
    expect(weightedBookUsd(pipeline([stage()]))).toBe(1_300_000);
  });
});

describe("fillNote", () => {
  it("should_fill_the_placeholder_from_the_commitment", () => {
    expect(fillNote("against a {target} commitment", "$250K H2")).toBe(
      "against a $250K H2 commitment",
    );
  });

  it("should_drop_the_sentence_that_needed_a_target_it_does_not_have", () => {
    expect(
      fillNote("Against a {target} commitment. The pool has room.", null),
    ).toBe("The pool has room.");
  });

  it("should_fall_back_rather_than_blank_a_note_that_is_all_target", () => {
    // Every REVENUE_BASIS reading is a fragment with no sentence to keep, so
    // without a fallback a renamed commitment would empty the table cell.
    expect(
      fillNote(
        "against a {target} commitment",
        null,
        "against its own funding commitment",
      ),
    ).toBe("against its own funding commitment");
  });

  it("should_return_nothing_when_there_is_no_fallback_either", () => {
    expect(fillNote("against a {target} commitment", null)).toBe("");
  });
});
