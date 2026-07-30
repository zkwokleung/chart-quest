import { describe, expect, it } from "vitest";
import type { Series } from "@/lib/chart/types";
import { barMark } from "../../mark";
import type { AnyStep, Attempt, Level, StepAttempt } from "../../schema";
import { gradeComposite, perfectComposite } from "./grade";
import { weightsOf } from "./steps";

function series(n = 30): Series<string> {
  const l = Array.from({ length: n }, (_, i) => 100 + i);
  return {
    id: "EURUSD-1d",
    tf: "1d",
    t: l.map((_, i) => Date.UTC(2024, 0, 1) + i * 86_400_000),
    o: l.map((low) => low + 2),
    h: l.map((low) => low + 6),
    l,
    c: l.map((low) => low + 4),
    v: l.map(() => 100),
  };
}

const data = [series()];

const misconceptions = [
  {
    id: "a",
    test: () => false,
    message: "a placeholder explanation, long enough",
  },
  {
    id: "b",
    test: () => false,
    message: "b placeholder explanation, long enough",
  },
];

/** Four stages mirroring boss 2.B, with the free predict step down-weighted. */
function steps(): AnyStep[] {
  return [
    {
      kind: "mark-bars",
      weight: 0.3,
      brief: "Mark the swing highs",
      config: { prompt: "?", mode: "bars" },
      target: { marks: [barMark(5), barMark(15)] },
      tolerance: { barSlop: 1 },
      misconceptions,
    },
    {
      kind: "annotate",
      weight: 0.35,
      brief: "Draw the trendline",
      config: {
        prompt: "?",
        shape: "trendline",
        side: "support",
        requiredTouches: 3,
        expectSlope: "up",
      },
      target: {
        reference: {
          shape: "trendline",
          a: { bar: 0, price: 100 },
          b: { bar: 29, price: 129 },
        },
      },
      tolerance: { priceFracOfRange: 0.02, barSlop: 1 },
      misconceptions,
    },
    {
      kind: "classify",
      weight: 0.25,
      brief: "Name the structure",
      config: { prompt: "?", options: [{ id: "up", label: "Uptrend" }] },
      target: { correct: ["up"] },
      tolerance: {},
      misconceptions,
    },
    {
      kind: "predict-next",
      weight: 0.1,
      brief: "Call the next bars",
      config: { prompt: "?", horizon: 3 },
      target: {},
      tolerance: {},
      misconceptions,
      data: [{ series: "EURUSD-1d", from: 0, to: 20 }],
    },
  ];
}

function level(over: Partial<Level<"composite">> = {}): Level<"composite"> {
  return {
    id: "2-B",
    chapter: 2,
    title: "Boss",
    kind: "composite",
    brief: "test",
    data: [{ series: "EURUSD-1d", from: 0, to: 30 }],
    config: { steps: steps() },
    target: {},
    tolerance: {},
    stars: [0.4, 0.7, 0.9],
    misconceptions,
    hints: [],
    ...over,
  };
}

function attempt(
  stepAttempts: (StepAttempt | null)[],
  hintsUsed = 0,
): Attempt["composite"] {
  return { kind: "composite", steps: stepAttempts, hintsUsed };
}

describe("weightsOf", () => {
  it("normalises weights that already sum to one", () => {
    const got = weightsOf(steps());
    [0.3, 0.35, 0.25, 0.1].forEach((want, i) => {
      expect(got[i]).toBeCloseTo(want, 10);
    });
  });

  it("normalises weights that do not, so a rounding slip cannot deflate a boss", () => {
    const half = steps().map(
      (s) => ({ ...s, weight: s.weight / 2 }) as AnyStep,
    );
    const normalised = weightsOf(half);
    expect(normalised.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
  });

  it("falls back to equal shares rather than dividing by zero", () => {
    const zeroed = steps().map((s) => ({ ...s, weight: 0 }) as AnyStep);
    expect(weightsOf(zeroed)).toEqual([0.25, 0.25, 0.25, 0.25]);
  });
});

describe("gradeComposite", () => {
  const lvl = level();

  it("gives full marks when every step is done perfectly", () => {
    const grade = gradeComposite(perfectComposite(lvl, data), lvl, data);
    expect(grade.score).toBeCloseTo(1, 6);
    expect(grade.stars).toBe(3);
  });

  it("scores zero with nothing attempted", () => {
    const grade = gradeComposite(attempt([null, null, null, null]), lvl, data);
    expect(grade.score).toBe(0);
    expect(grade.stars).toBe(0);
  });

  it("weights each step by its share", () => {
    // Only the classify step, worth 25%.
    const grade = gradeComposite(
      attempt([
        null,
        null,
        { kind: "classify", selected: ["up"], hintsUsed: 0 },
        null,
      ]),
      lvl,
      data,
    );
    expect(grade.score).toBeCloseTo(0.25, 6);
  });

  it("does not let the free predict step carry a failing run", () => {
    // predict-next scores participation, so it always pays out. At equal weights
    // it would contribute 25% and quietly lower the bar for the other stages; at
    // 10% a perfect predict alone cannot reach even one star.
    const grade = gradeComposite(
      attempt([
        null,
        null,
        null,
        { kind: "predict-next", calls: ["up"], hintsUsed: 0 },
      ]),
      lvl,
      data,
    );
    expect(grade.score).toBeCloseTo(0.1, 6);
    expect(grade.stars).toBe(0);
  });

  it("clears the two-star gate on a mixed run", () => {
    // The design intent: a boss tests the chapter without walling a player who is
    // weaker at one stage.
    const perfect = perfectComposite(lvl, data);
    const mixed = attempt([
      // One of two swing highs found.
      { kind: "mark-bars", marks: [barMark(5)], hintsUsed: 0 },
      perfect.steps[1] ?? null,
      perfect.steps[2] ?? null,
      perfect.steps[3] ?? null,
    ]);
    const grade = gradeComposite(mixed, lvl, data);
    expect(grade.score).toBeGreaterThanOrEqual(0.7);
    expect(grade.stars).toBeGreaterThanOrEqual(2);
  });

  it("labels each step's diagnosis with the stage it came from", () => {
    const withDiagnosis = level({
      config: {
        steps: steps().map((s, i) =>
          i === 0
            ? ({
                ...s,
                misconceptions: [
                  {
                    id: "missed-some",
                    test: () => true,
                    message: "you found only one of the swing highs here",
                  },
                  misconceptions[1]!,
                ],
              } as AnyStep)
            : s,
        ),
      },
    });
    const grade = gradeComposite(
      attempt([
        { kind: "mark-bars", marks: [barMark(5)], hintsUsed: 0 },
        null,
        null,
        null,
      ]),
      withDiagnosis,
      data,
    );
    const messages = grade.diagnosis.map((d) => d.message);
    expect(messages.some((m) => m.startsWith("Mark the swing highs — "))).toBe(
      true,
    );
  });

  it("reports a per-step breakdown for the score card", () => {
    const grade = gradeComposite(perfectComposite(lvl, data), lvl, data);
    expect(Object.keys(grade.detail ?? {})).toHaveLength(4);
    expect(grade.detail?.["3. classify"]).toBe("100% × 25%");
  });

  it("marks an unattempted step as such rather than silently scoring it", () => {
    const grade = gradeComposite(attempt([null, null, null, null]), lvl, data);
    expect(grade.detail?.["1. mark-bars"]).toMatch(/not attempted/);
  });

  it("caps stars when hints were taken", () => {
    const perfect = perfectComposite(lvl, data);
    const grade = gradeComposite({ ...perfect, hintsUsed: 1 }, lvl, data);
    expect(grade.stars).toBe(2);
  });
});

describe("perfectComposite", () => {
  it("builds one attempt per step, using each kind's own perfect answer", () => {
    const perfect = perfectComposite(level(), data);
    expect(perfect.steps).toHaveLength(4);
    expect(perfect.steps.map((s) => s?.kind)).toEqual([
      "mark-bars",
      "annotate",
      "classify",
      "predict-next",
    ]);
  });
});
