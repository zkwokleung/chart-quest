import { describe, expect, it } from "vitest";
import type { Series } from "@/lib/chart/types";
import type { Attempt, Level } from "../../schema";
import { exploredFraction, gradeTuneParam, perfectTuneParam } from "./grade";

const series: Series<string> = {
  id: "FIXTURE-1d",
  tf: "1d",
  t: Array.from({ length: 300 }, (_, i) => Date.UTC(2020, 0, i + 1)),
  o: Array.from({ length: 300 }, (_, i) => 100 + i),
  h: Array.from({ length: 300 }, (_, i) => 101 + i),
  l: Array.from({ length: 300 }, (_, i) => 99 + i),
  c: Array.from({ length: 300 }, (_, i) => 100 + i),
  v: Array.from({ length: 300 }, () => 1000),
};

function level(over: Partial<Level<"tune-param">> = {}): Level<"tune-param"> {
  return {
    id: "5-2",
    chapter: 5,
    title: "Test slider",
    kind: "tune-param",
    brief: "Move it.",
    data: [{ series: "FIXTURE-1d", from: 0, to: 300 }],
    config: {
      prompt: "Find the period.",
      label: "period",
      min: 5,
      max: 205,
      step: 5,
      initial: 20,
      indicator: (value) => ({ kind: "sma", period: value }),
      scoring: "target",
    },
    target: { value: 50 },
    tolerance: { slop: 5 },
    stars: [0.4, 0.7, 0.9],
    misconceptions: [
      {
        id: "too-short",
        test: (attempt, lvl) => attempt.value < lvl.target.value / 2,
        message: "A very short average is mostly noise, not structure.",
      },
      {
        id: "barely-moved",
        test: (attempt) => attempt.visited.length <= 1,
        message: "You committed without moving the slider at all.",
      },
    ],
    hints: [],
    ...over,
  };
}

function attempt(
  over: Partial<Attempt["tune-param"]> = {},
): Attempt["tune-param"] {
  return {
    kind: "tune-param",
    value: 50,
    visited: [20, 50],
    hintsUsed: 0,
    ...over,
  };
}

describe("target scoring", () => {
  it("gives full marks at the answer", () => {
    expect(
      gradeTuneParam(attempt({ value: 50 }), level(), [series]).score,
    ).toBe(1);
  });

  it("gives full marks anywhere inside the slop", () => {
    // Same treatment as barSlop in mark-bars: within tolerance is correct, not
    // nearly correct. A slider with a step of 5 should not punish landing on 45.
    expect(
      gradeTuneParam(attempt({ value: 45 }), level(), [series]).score,
    ).toBe(1);
    expect(
      gradeTuneParam(attempt({ value: 55 }), level(), [series]).score,
    ).toBe(1);
  });

  it("decays past the slop rather than falling off a cliff", () => {
    const near = gradeTuneParam(attempt({ value: 60 }), level(), [
      series,
    ]).score;
    const far = gradeTuneParam(attempt({ value: 75 }), level(), [series]).score;
    expect(near).toBeGreaterThan(0);
    expect(near).toBeGreaterThan(far);
  });

  it("reaches zero well before the end of the range", () => {
    expect(
      gradeTuneParam(attempt({ value: 205 }), level(), [series]).score,
    ).toBe(0);
  });

  it("shows the answer in the correction", () => {
    const grade = gradeTuneParam(attempt({ value: 90 }), level(), [series]);
    expect(grade.reference.kind === "param" && grade.reference.target).toBe(50);
  });
});

describe("exploration scoring", () => {
  const exploring = level({
    config: {
      ...level().config,
      scoring: "exploration",
      exploreFraction: 0.6,
    },
  });

  it("scores how much of the range was seen, not where the slider stopped", () => {
    // 5.1 has no right answer — a shorter average lags less and whips more, which
    // is a trade-off. Scoring a "correct" period would teach a falsehood in the
    // chapter about not trusting indicators.
    const wide = gradeTuneParam(
      attempt({ value: 5, visited: [5, 205] }),
      exploring,
      [series],
    );
    const narrow = gradeTuneParam(
      attempt({ value: 5, visited: [5, 25] }),
      exploring,
      [series],
    );
    expect(wide.score).toBe(1);
    expect(narrow.score).toBeLessThan(0.3);
  });

  it("gives the same score wherever the slider ends up", () => {
    const a = gradeTuneParam(
      attempt({ value: 5, visited: [5, 205] }),
      exploring,
      [series],
    );
    const b = gradeTuneParam(
      attempt({ value: 205, visited: [5, 205] }),
      exploring,
      [series],
    );
    expect(a.score).toBe(b.score);
  });

  it("offers no correction, because there is nothing to correct", () => {
    // Showing a "right answer" at the end would undo the whole lesson.
    const grade = gradeTuneParam(
      attempt({ value: 100, visited: [5, 205] }),
      exploring,
      [series],
    );
    expect(
      grade.reference.kind === "param" && grade.reference.target,
    ).toBeNull();
  });

  it("scores nothing for committing without moving", () => {
    const grade = gradeTuneParam(
      attempt({ value: 20, visited: [20] }),
      exploring,
      [series],
    );
    expect(grade.score).toBe(0);
    expect(grade.diagnosis.some((d) => d.id === "barely-moved")).toBe(true);
  });
});

describe("exploredFraction", () => {
  it("is the span covered over the span available", () => {
    expect(
      exploredFraction(attempt({ visited: [5, 105] }), level()),
    ).toBeCloseTo(0.5);
    expect(exploredFraction(attempt({ visited: [5, 205] }), level())).toBe(1);
  });

  it("counts the span, not the number of stops", () => {
    // Nudging the slider forty times inside one corner is not exploring.
    const many = Array.from({ length: 40 }, (_, i) => 5 + i);
    expect(exploredFraction(attempt({ visited: many }), level())).toBeLessThan(
      0.25,
    );
  });

  it("falls back to the committed value when nothing was recorded", () => {
    expect(exploredFraction(attempt({ visited: [] }), level())).toBe(0);
  });
});

describe("perfectTuneParam", () => {
  it("hits the target on a target level", () => {
    const reference = perfectTuneParam(level());
    expect(gradeTuneParam(reference, level(), [series]).stars).toBe(3);
  });

  it("explores the range on an exploration level", () => {
    // Without this the winnability guard would fail a correct level: an exploration
    // level is won by having looked, so the reference has to have looked.
    const exploring = level({
      config: { ...level().config, scoring: "exploration" },
    });
    const reference = perfectTuneParam(exploring);
    expect(gradeTuneParam(reference, exploring, [series]).stars).toBe(3);
  });
});
