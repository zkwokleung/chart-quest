import { describe, expect, it } from "vitest";
import type { Series } from "@/lib/chart/types";
import type { Attempt, Level } from "../../schema";
import { gradeReplayTrade, measurePlan, perfectReplayTrade } from "./grade";

/**
 * A synthetic market with a zone at 95–100, a long entry at 100, and a rally that
 * runs to 130 without ever pulling back.
 *
 * Written out so each test can say exactly which stop survives and which does not,
 * rather than depending on a real window whose shape has to be looked up. ATR at
 * the trigger works out at about 4.9, which is what makes the ATR-band numbers
 * below land where they do.
 *
 * The rally deliberately never trades back below 100. An earlier version dipped to
 * 98.5 on the first bar, which quietly stopped out the "lucky winner" the cap test
 * needs — the fixture, not the assertion, was wrong.
 */
function market(): Series<string> {
  const bars: [number, number, number, number][] = [];
  // 20 bars ranging 95 to 100.
  for (let i = 0; i < 20; i += 1) bars.push([97, 100, 95, 98]);
  // The trigger bar closes at 100.
  bars.push([98, 101, 97, 100]);
  for (let i = 0; i < 20; i += 1) {
    const base = 100.5 + i * 1.5;
    bars.push([base, base + 2, base - 0.5, base + 1]);
  }
  return {
    id: "FIXTURE-1d",
    tf: "1d",
    t: bars.map((_, i) => Date.UTC(2020, 0, i + 1)),
    o: bars.map((b) => b[0]),
    h: bars.map((b) => b[1]),
    l: bars.map((b) => b[2]),
    c: bars.map((b) => b[3]),
    v: bars.map(() => 1000),
  };
}

const TRIGGER = 20;

function level(
  overrides: Partial<Level<"replay-trade">> = {},
): Level<"replay-trade"> {
  return {
    id: "3-B",
    chapter: 3,
    title: "Test trade",
    kind: "replay-trade",
    brief: "A trade on a synthetic market.",
    data: [{ series: "FIXTURE-1d", from: 0, to: 41 }],
    config: {
      prompt: "Trade the retest.",
      side: "long",
      primeBars: 21,
      maxBars: 20,
      minRR: 2,
      atrPeriod: 14,
    },
    target: {
      structure: { shape: "zone", top: 100, bottom: 95 },
      triggerBar: TRIGGER,
    },
    tolerance: { minAtr: 0.3, maxAtr: 3, barSlop: 2 },
    stars: [0.4, 0.7, 0.9],
    misconceptions: [
      {
        id: "stop-inside-zone",
        test: (attempt, lvl) => {
          const s = lvl.target.structure;
          return s.shape === "zone" && attempt.stop > s.bottom;
        },
        message: "Your stop is inside the zone the trade depends on.",
      },
      {
        id: "no-target",
        test: (attempt) => attempt.target === null,
        message: "No target means no reward:risk to judge.",
      },
    ],
    hints: [],
    ...overrides,
  };
}

function attempt(
  over: Partial<Attempt["replay-trade"]> = {},
): Attempt["replay-trade"] {
  return {
    kind: "replay-trade",
    entryBar: TRIGGER,
    stop: 93,
    target: 114,
    reason: "Retest of the zone that broke.",
    hintsUsed: 0,
    ...over,
  };
}

const data = [market()];

describe("the plan and outcome split", () => {
  it("gives a profitable trade on a stupid stop exactly one star", () => {
    // Epic #23's scenario, verbatim. The stop is crammed 0.1 ATR under entry and
    // inside the zone the idea rests on — where every other stop is — but the
    // target is a sensible 3R and the entry is on time. The market runs to 130, so
    // this is a clean, lucky win.
    const lucky = attempt({ stop: 99.5, target: 121.5 });
    const grade = gradeReplayTrade(lucky, level(), data);

    expect(
      grade.reference.kind === "trade" && grade.reference.r,
    ).toBeGreaterThan(0);
    expect(grade.stars).toBe(1);
  });

  it("lets no weak plan reach two stars, whatever the outcome", () => {
    // The real guarantee, asserted as an invariant rather than as a star count.
    // At Chapter 3's thresholds the weighting alone already enforces it — a plan
    // must score 0.571 to clear two stars on a perfect outcome, which is above the
    // floor, so PLAN_FLOOR's cap never fires today. It is kept for when #32
    // retunes thresholds against real play data, and this test is what will catch
    // it if that retune ever opens the gap.
    const weakPlans = [
      attempt({ stop: 99.5, target: 121.5 }), // stop crammed inside the zone
      attempt({ stop: 99.8, target: 105 }), // crammed and a poor target
      attempt({ stop: 97, target: 121.5 }), // inside the zone
      attempt({ stop: 99.5, target: 121.5, entryBar: TRIGGER + 9 }), // and late
    ];
    for (const weak of weakPlans) {
      const plan = measurePlan(weak, level(), data[0]!);
      if ((plan?.score ?? 1) >= 0.5) continue;
      const grade = gradeReplayTrade(weak, level(), data);
      expect(
        grade.stars,
        `plan ${plan?.score} reached ${grade.stars} stars`,
      ).toBeLessThanOrEqual(1);
    }
  });

  it("lets a well-planned loss still clear two stars", () => {
    // The mirror, and just as load-bearing: punishing a good plan that lost would
    // teach that being right is the same as being good. Same plan, a market that
    // simply went the other way.
    const falling = market();
    for (let i = TRIGGER + 1; i < falling.t.length; i += 1) {
      const base = 100 - (i - TRIGGER) * 1.5;
      falling.o[i] = base;
      falling.h[i] = base + 1;
      falling.l[i] = base - 2;
      falling.c[i] = base - 1;
    }
    const grade = gradeReplayTrade(attempt(), level(), [falling]);

    expect(grade.reference.kind === "trade" && grade.reference.r).toBeLessThan(
      0,
    );
    expect(grade.stars).toBeGreaterThanOrEqual(2);
  });

  it("scores a good plan that won above a good plan that lost", () => {
    const falling = market();
    for (let i = TRIGGER + 1; i < falling.t.length; i += 1) {
      const base = 100 - (i - TRIGGER) * 1.5;
      falling.o[i] = base;
      falling.h[i] = base + 1;
      falling.l[i] = base - 2;
      falling.c[i] = base - 1;
    }
    const won = gradeReplayTrade(attempt(), level(), data);
    const lost = gradeReplayTrade(attempt(), level(), [falling]);
    expect(won.score).toBeGreaterThan(lost.score);
  });

  it("gives the outcome no more than its 0.3 share", () => {
    // What actually keeps a lucky winner down at Chapter 3's thresholds: the
    // outcome can contribute at most 0.3, so a plan scoring 0.25 tops out at 0.475
    // and cannot reach the 0.7 the second star needs.
    const weak = attempt({ stop: 99.8, target: 105 });
    const plan = measurePlan(weak, level(), data[0]!);
    const grade = gradeReplayTrade(weak, level(), data);
    expect(grade.score).toBeLessThanOrEqual((plan?.score ?? 0) * 0.7 + 0.3);
  });
});

describe("the plan components", () => {
  it("requires the stop beyond the structure, not inside it", () => {
    expect(
      measurePlan(attempt({ stop: 93 }), level(), data[0]!)?.beyondStructure,
    ).toBe(true);
    expect(
      measurePlan(attempt({ stop: 97 }), level(), data[0]!)?.beyondStructure,
    ).toBe(false);
  });

  it("rejects a stop with no room, measured in ATR", () => {
    const crowded = measurePlan(attempt({ stop: 99.8 }), level(), data[0]!);
    expect(crowded?.roomAtr).toBeLessThan(0.3);
    expect(crowded?.roomOk).toBe(false);
  });

  it("rejects a stop so wide it is not a stop", () => {
    const absurd = measurePlan(attempt({ stop: 50 }), level(), data[0]!);
    expect(absurd?.roomOk).toBe(false);
  });

  it("requires reward:risk to clear minRR", () => {
    expect(measurePlan(attempt({ target: 114 }), level(), data[0]!)?.rrOk).toBe(
      true,
    );
    expect(measurePlan(attempt({ target: 105 }), level(), data[0]!)?.rrOk).toBe(
      false,
    );
    expect(
      measurePlan(attempt({ target: null }), level(), data[0]!)?.rrOk,
    ).toBe(false);
  });

  it("requires entering near the bar the setup triggered on", () => {
    expect(
      measurePlan(attempt({ entryBar: TRIGGER + 2 }), level(), data[0]!)
        ?.onTime,
    ).toBe(true);
    expect(
      measurePlan(attempt({ entryBar: TRIGGER + 9 }), level(), data[0]!)
        ?.onTime,
    ).toBe(false);
  });
});

describe("gates", () => {
  it("scores zero when the stop is on the wrong side of entry", () => {
    // Not a badly-planned trade — not a trade. Same treatment as a support line
    // sloping the wrong way in `annotate`.
    const grade = gradeReplayTrade(attempt({ stop: 105 }), level(), data);
    expect(grade.score).toBe(0);
    expect(grade.stars).toBe(0);
    expect(grade.detail?.["plan"]).toContain("wrong side");
  });

  it("still returns a diagnosis when it scores zero", () => {
    const grade = gradeReplayTrade(attempt({ stop: 105 }), level(), data);
    expect(grade.diagnosis.length).toBeGreaterThan(0);
  });
});

describe("perfectReplayTrade", () => {
  it("earns three stars through the grader, so the level is winnable", () => {
    // The generic authoring guard runs this over every level; asserting it here
    // too means a change to the reference construction fails in this file, next to
    // the reasoning, rather than only in guards.test.ts.
    const reference = perfectReplayTrade(level(), data);
    const grade = gradeReplayTrade(reference, level(), data);
    expect(grade.stars).toBe(3);
  });

  it("places its stop beyond the structure with room inside the band", () => {
    const reference = perfectReplayTrade(level(), data);
    const plan = measurePlan(reference, level(), data[0]!);
    expect(plan?.beyondStructure).toBe(true);
    expect(plan?.roomOk).toBe(true);
    expect(plan?.rrOk).toBe(true);
  });
});

describe("the journal entry", () => {
  it("reports the R the score card reports", () => {
    const grade = gradeReplayTrade(attempt(), level(), data);
    if (grade.reference.kind !== "trade")
      throw new Error("expected a trade overlay");
    // The journal is written from this overlay, so the record cannot disagree with
    // what the player was told.
    expect(grade.reference.r).toBeCloseTo(2, 1);
    expect(grade.reference.outcome).toContain("target hit");
  });

  it("names a gap in the outcome text when one happens", () => {
    const gapped = market();
    // Next bar opens far below the stop at 93.
    gapped.o[TRIGGER + 1] = 80;
    gapped.h[TRIGGER + 1] = 81;
    gapped.l[TRIGGER + 1] = 78;
    gapped.c[TRIGGER + 1] = 79;
    const grade = gradeReplayTrade(attempt(), level(), [gapped]);
    if (grade.reference.kind !== "trade")
      throw new Error("expected a trade overlay");
    expect(grade.reference.outcome).toContain("gapped");
    expect(grade.reference.r).toBeLessThan(-1);
  });
});
