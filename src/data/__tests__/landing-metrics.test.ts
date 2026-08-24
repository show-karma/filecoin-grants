import { describe, expect, it } from "vitest";

import {
  FALLBACK_COUNTS,
  FALLBACK_METRICS,
  parseCommunityMetrics,
  trackFor,
  tracksReconcile,
  type CommunityMetrics,
  type LiveCounts,
} from "../../lib/karma";
import {
  buildHeadlineStats,
  buildObjectiveCards,
  objectiveAmount,
  objectiveInitiatives,
  OBJECTIVES,
  portfolioCompletion,
  totalCommitted,
  asMillions,
} from "../landing";

import metricsSample from "./fixtures/community-metrics.json";

/**
 * The production API answers the same endpoint without a `funding` block. This
 * strips it from the captured payload rather than hand-writing a second one, so
 * the two fixtures cannot drift apart.
 */
const withoutFunding = () => {
  const { funding: _funding, ...rest } = metricsSample as Record<
    string,
    unknown
  >;
  return rest;
};

const counts: LiveCounts = {
  projects: 48,
  milestonesDone: 98,
  milestonesTotal: 197,
  live: true,
};

const statValues = (...args: Parameters<typeof buildHeadlineStats>) =>
  buildHeadlineStats(...args).map((stat) => stat.value);

describe("parseCommunityMetrics", () => {
  it("reads the funding totals from a full payload", () => {
    expect(parseCommunityMetrics(metricsSample)).toMatchObject({
      distinctProjects: 47,
      avgMilestoneCompletion: 52.1,
      allocated: 8_642_697,
      live: true,
    });
  });

  it("normalises every byTrack row", () => {
    expect(parseCommunityMetrics(metricsSample).byTrack).toEqual([
      {
        track: "R&D",
        allocated: 7_273_500,
        disbursed: 4_429_599,
        projects: 34,
        avgMilestoneCompletion: 66.9,
      },
      {
        track: "Kernel",
        allocated: 1_812_267,
        disbursed: null,
        projects: 13,
        avgMilestoneCompletion: 1.3,
      },
      {
        track: "Revenue Development",
        allocated: 880_974,
        disbursed: 563_337,
        projects: 3,
        avgMilestoneCompletion: 100,
      },
    ]);
  });

  it("keeps usable rows and drops null, zero, and nameless ones", () => {
    const parsed = parseCommunityMetrics({
      funding: {
        byTrack: [
          { trackId: "a", track: " Kernel ", allocated: 0, projects: null },
          { trackId: "b", allocated: 100, projects: 2 },
          { trackId: "c", track: "   ", allocated: 100 },
          null,
          "Kernel",
          { trackId: "d", track: "Ghost Track", allocated: 42, projects: 1 },
        ],
      },
    });

    expect(parsed.byTrack).toEqual([
      {
        track: "Kernel",
        allocated: null,
        disbursed: null,
        projects: null,
        avgMilestoneCompletion: null,
      },
      {
        track: "Ghost Track",
        allocated: 42,
        disbursed: null,
        projects: 1,
        avgMilestoneCompletion: null,
      },
    ]);
    // byTrack alone is a live read, even with no `totals` alongside it.
    expect(parsed.live).toBe(true);
  });

  it("has no tracks when byTrack is absent or not an array", () => {
    for (const byTrack of [undefined, null, {}, "R&D", 3]) {
      expect(parseCommunityMetrics({ funding: { byTrack } }).byTrack).toEqual(
        [],
      );
    }
    expect(parseCommunityMetrics(withoutFunding()).byTrack).toEqual([]);
  });

  it("treats a production payload with no funding block as a normal outcome", () => {
    expect(parseCommunityMetrics(withoutFunding())).toEqual(FALLBACK_METRICS);
  });

  it("survives malformed and empty bodies", () => {
    for (const payload of [
      null,
      undefined,
      "",
      "not json",
      42,
      {},
      { funding: null },
      { funding: {} },
      { funding: { totals: null } },
      { funding: { programs: [] } },
    ]) {
      expect(parseCommunityMetrics(payload)).toEqual(FALLBACK_METRICS);
    }
  });

  it("drops individual fields that are missing, null, or unusable", () => {
    expect(
      parseCommunityMetrics({
        funding: {
          totals: {
            distinctProjects: null,
            avgMilestoneCompletion: 52.1,
          },
        },
      }),
    ).toEqual({
      distinctProjects: null,
      avgMilestoneCompletion: 52.1,
      allocated: null,
      byTrack: [],
      live: true,
    });

    expect(
      parseCommunityMetrics({
        funding: {
          totals: {
            distinctProjects: 0,
            avgMilestoneCompletion: Number.NaN,
            allocated: "8642697",
          },
        },
      }),
    ).toEqual(FALLBACK_METRICS);
  });
});

describe("buildHeadlineStats", () => {
  it("uses the live funding totals when the funding block is present", () => {
    const [committed, projects, initiatives, completion] = statValues(
      counts,
      parseCommunityMetrics(metricsSample),
    );

    // The API's allocated total is the published figure now, not FINANCIALS.
    expect(committed).toBe("$8.64M");
    expect(committed).not.toBe(asMillions(totalCommitted()));
    expect(projects).toBe("47");
    expect(initiatives).toBe("3");
    expect(completion).toBe("52%");
  });

  it("falls back per figure on a production payload with no funding block", () => {
    const [committed, projects, initiatives, completion] = statValues(
      counts,
      parseCommunityMetrics(withoutFunding()),
    );

    expect(committed).toBe("$10.08M");
    expect(projects).toBe(String(counts.projects));
    expect(initiatives).toBe("3");
    expect(completion).toBe(`${portfolioCompletion()}%`);
  });

  it("falls back to the committed counts when the grants read failed too", () => {
    const [, projects] = statValues(FALLBACK_COUNTS, FALLBACK_METRICS);
    expect(projects).toBe(String(FALLBACK_COUNTS.projects));
  });

  it("falls back to the committed counts when the grants read returned zero", () => {
    const [, projects] = statValues({ ...counts, projects: 0 }, FALLBACK_METRICS);
    expect(projects).toBe(String(FALLBACK_COUNTS.projects));
  });

  it("defaults to the committed figures when no metrics are passed at all", () => {
    expect(statValues(counts)).toEqual([
      "$10.08M",
      "48",
      "3",
      `${portfolioCompletion()}%`,
    ]);
  });

  it("never renders an empty, zero, or NaN figure on any payload", () => {
    const payloads: unknown[] = [
      metricsSample,
      withoutFunding(),
      null,
      "",
      {},
      { funding: { totals: {} } },
      { funding: { totals: { distinctProjects: 0, avgMilestoneCompletion: 0 } } },
      {
        funding: {
          totals: {
            distinctProjects: Number.NaN,
            avgMilestoneCompletion: null,
            allocated: -1,
          },
        },
      },
    ];

    for (const payload of payloads) {
      for (const liveCounts of [counts, FALLBACK_COUNTS, { ...counts, projects: 0 }]) {
        for (const value of statValues(
          liveCounts,
          parseCommunityMetrics(payload),
        )) {
          expect(value).not.toBe("");
          expect(value).not.toBe("0");
          expect(value).not.toBe("0%");
          expect(value).not.toBe("$0.00M");
          expect(value).not.toMatch(/NaN|undefined|null/);
        }
      }
    }
  });

  it("truncates the completion rather than rounding it up", () => {
    const completion = (avgMilestoneCompletion: number) =>
      statValues(
        counts,
        parseCommunityMetrics({ funding: { totals: { avgMilestoneCompletion } } }),
      )[3];

    expect(completion(52.1)).toBe("52%");
    expect(completion(52.9)).toBe("52%");
    expect(completion(99.99)).toBe("99%");
    expect(completion(0.9)).toBe(`${portfolioCompletion()}%`);
  });
});

describe("trackFor", () => {
  const metrics = parseCommunityMetrics(metricsSample);

  it("matches a track name regardless of case or padding", () => {
    for (const name of ["Kernel", "kernel", "  KERNEL  "]) {
      expect(trackFor(metrics, name)?.allocated).toBe(1_812_267);
    }
    expect(trackFor(metrics, "revenue development")?.projects).toBe(3);
  });

  it("returns null for a track the API does not carry", () => {
    expect(trackFor(metrics, "Growth")).toBeNull();
    expect(trackFor(FALLBACK_METRICS, "Kernel")).toBeNull();
  });

  it("matches every objective on the page", () => {
    for (const objective of OBJECTIVES) {
      expect(trackFor(metrics, objective.program)).not.toBeNull();
    }
  });
});

describe("tracksReconcile", () => {
  /**
   * A tripwire, deliberately not a gate. The published footers are the API's
   * per-track figures even though they sum to $9,966,741 against a
   * `totals.allocated` of $8,642,697 — the programme team accepted that. So
   * this reports the state of the mismatch rather than asserting it: pinning
   * today's overshoot would turn the backend fixing its track mapping into a
   * red build, which is exactly the wrong signal.
   */
  it("reports whether the live tracks reconcile against the community total", () => {
    const metrics = parseCommunityMetrics(metricsSample);
    const summed = metrics.byTrack.reduce(
      (total, row) => total + (row.allocated ?? 0),
      0,
    );
    const drift = summed - (metrics.allocated ?? 0);

    console.info(
      tracksReconcile(metrics)
        ? "[tripwire] byTrack now reconciles with funding.totals — the objective footers no longer overshoot the Committed to date tile"
        : `[tripwire] byTrack overshoots funding.totals by $${drift.toLocaleString("en-US")} — published knowingly`,
    );

    // The invariant, true on either side of that fix: the helper agrees with
    // the arithmetic it stands in for.
    expect(tracksReconcile(metrics)).toBe(Math.abs(drift) <= 1);
  });

  it("passes when the parts add up, and never on a partial read", () => {
    const reconciling = parseCommunityMetrics({
      funding: {
        totals: { allocated: 300 },
        byTrack: [
          { track: "Kernel", allocated: 100 },
          { track: "R&D", allocated: 200 },
        ],
      },
    });
    expect(tracksReconcile(reconciling)).toBe(true);

    expect(tracksReconcile(FALLBACK_METRICS)).toBe(false);
    expect(
      tracksReconcile(
        parseCommunityMetrics({
          funding: { byTrack: [{ track: "Kernel", allocated: 100 }] },
        }),
      ),
    ).toBe(false);
  });
});

describe("buildObjectiveCards", () => {
  const live = parseCommunityMetrics(metricsSample);

  /** The card carries count and noun apart so the footer can weight them. */
  const label = ({ count, noun }: { count: number; noun: string }) =>
    `${count} ${noun}`;

  const footers = (metrics?: CommunityMetrics) =>
    buildObjectiveCards(metrics).map((card) => [
      card.objective.program,
      label(card.initiatives),
      card.amount,
    ]);

  it("publishes the API's track figures, which the programme team chose knowingly", () => {
    expect(footers(live)).toEqual([
      ["Kernel", "13 initiatives", "$1.81M"],
      ["Revenue Development", "3 initiatives", "$881k"],
      ["R&D", "34 initiatives", "$7.27M"],
    ]);
  });

  it("leaves the rest of every card untouched", () => {
    for (const [index, card] of buildObjectiveCards(live).entries()) {
      expect(card.objective).toBe(OBJECTIVES[index]);
    }
  });

  it("falls back to the editorial footers with no metrics, a missing track, or junk", () => {
    const expected = [
      ["Kernel", "10 initiatives", "$2.3M"],
      ["Revenue Development", "14 initiatives", "$3.2M"],
      ["R&D", "7 initiatives", "$1.4M"],
    ];

    for (const metrics of [
      undefined,
      FALLBACK_METRICS,
      parseCommunityMetrics(withoutFunding()),
      parseCommunityMetrics(null),
      // Kernel absent, an unknown track present, and holes in what is left.
      parseCommunityMetrics({
        funding: {
          byTrack: [
            { track: "Ghost Track", allocated: 1_000_000, projects: 9 },
            { track: "R&D", allocated: null, projects: 0 },
            { track: "Revenue Development", allocated: Number.NaN },
          ],
        },
      }),
    ]) {
      expect(footers(metrics)).toEqual(expected);
    }
  });

  it("never renders an empty, zero, or NaN footer", () => {
    for (const metrics of [
      undefined,
      live,
      FALLBACK_METRICS,
      parseCommunityMetrics({ funding: { byTrack: [] } }),
      parseCommunityMetrics({
        funding: { byTrack: [{ track: "Kernel", allocated: 0, projects: 0 }] },
      }),
    ]) {
      for (const card of buildObjectiveCards(metrics)) {
        const initiatives = `${card.initiatives.count} ${card.initiatives.noun}`;
        for (const value of [initiatives, card.amount]) {
          expect(value).not.toBe("");
          // A true zero only — "$0.88M" would be a legitimate sub-million
          // award, and `trackAmount` renders those as "$881k" anyway.
          expect(value).not.toMatch(/^0 |^\$0(\.0+)?[MK]?$|NaN|undefined|null/);
        }
        expect(initiatives).toMatch(/^[1-9]\d* initiatives?$/);
        expect(card.amount).toMatch(/^\$[1-9][\d.]*[Mk]?$/);
      }
    }
  });

  it("pluralises the initiative count", () => {
    // The live count wins, so singular has to be exercised through a track.
    const one = parseCommunityMetrics({
      funding: { byTrack: [{ track: "Kernel", allocated: 1_000_000, projects: 1 }] },
    });
    expect(objectiveInitiatives(OBJECTIVES[0], one)).toEqual({ count: 1, noun: "initiative" });
    expect(objectiveInitiatives(OBJECTIVES[0], live)).toEqual({ count: 13, noun: "initiatives" });
    // And singular still works on the fallback path.
    const solo = { ...OBJECTIVES[0], initiatives: 1 };
    expect(objectiveInitiatives(solo, FALLBACK_METRICS)).toEqual({ count: 1, noun: "initiative" });
  });

  it("formats a track amount the way the rest of the page does", () => {
    expect(objectiveAmount(OBJECTIVES[0], live)).toBe("$1.81M");
    expect(asMillions(trackFor(live, "Kernel")?.allocated ?? 0)).toBe("$1.81M");
    // Falls back to the editorial figure when the track cannot be read.
    expect(objectiveAmount(OBJECTIVES[0], FALLBACK_METRICS)).toBe(OBJECTIVES[0].amount);
  });
});
