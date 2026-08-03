import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Attempt, Level } from "../../schema";
import { exploredFraction, gradeProbe, perfectProbe } from "./grade";

function build(overrides: Partial<Level<"probe">> = {}): Level<"probe"> {
  return {
    id: "8-2",
    chapter: 8,
    title: "fixture",
    kind: "probe",
    brief: "fixture",
    data: [],
    config: {
      prompt: "find the crossing",
      measure: "variance-ratio",
      label: "horizon",
      min: 2,
      max: 90,
      step: 1,
      initial: 2,
      assets: ["BTCUSDT-1d", "SPY-1d"],
      focus: "BTCUSDT-1d",
      scoring: "target",
    },
    target: { value: 10 },
    tolerance: { slop: 2 },
    stars: [0.5, 0.75, 0.95],
    misconceptions: [
      { id: "a", test: () => false, message: "x" },
      { id: "b", test: () => false, message: "y" },
    ],
    hints: [],
    ...overrides,
  };
}

const attemptOf = (
  value: number,
  visited: number[],
  hintsUsed = 0,
): Attempt["probe"] => ({ kind: "probe", value, visited, hintsUsed });

describe("the sweep, which is what the level is actually about", () => {
  it("measures how much of the range was visited", () => {
    const level = build();
    expect(exploredFraction(attemptOf(10, [2, 90]), level)).toBe(1);
    expect(exploredFraction(attemptOf(10, [2, 46]), level)).toBeCloseTo(0.5, 2);
    expect(exploredFraction(attemptOf(10, [10]), level)).toBe(0);
  });

  it("caps a correct answer that was never swept for", () => {
    // Issue #26's requirement, enforced rather than hoped for: a player who drags straight to
    // the crossing has read a number off a table, not measured anything.
    const level = build();
    const lucky = gradeProbe(attemptOf(10, [2, 10]), level, []);
    const earned = gradeProbe(attemptOf(10, [2, 90]), level, []);
    expect(earned.score).toBe(1);
    expect(lucky.score).toBeLessThan(0.5);
    expect(lucky.stars).toBeLessThan(earned.stars);
  });

  it("barely penalises a nearly-complete sweep, because the sweep is the means", () => {
    const level = build();
    // 55% of the range against a 60% requirement.
    const nearly = gradeProbe(attemptOf(10, [2, 50]), level, []);
    expect(nearly.score).toBeGreaterThan(0.8);
  });

  it("reports what was explored either way", () => {
    const level = build();
    expect(gradeProbe(attemptOf(10, [2, 90]), level, []).detail?.explored).toBe(
      "100% of the range",
    );
  });
});

describe("scoring against the measured answer", () => {
  it("forgives inside the tolerance and decays outside it", () => {
    const level = build();
    const full = [2, 90];
    expect(gradeProbe(attemptOf(10, full), level, []).score).toBe(1);
    expect(gradeProbe(attemptOf(12, full), level, []).score).toBe(1);
    expect(gradeProbe(attemptOf(14, full), level, []).score).toBeLessThan(1);
    expect(gradeProbe(attemptOf(40, full), level, []).score).toBe(0);
  });

  it("names the answer and the distance in the correction", () => {
    const grade = gradeProbe(attemptOf(14, [2, 90]), build(), []);
    expect(grade.detail?.answer).toBe(10);
    expect(grade.detail?.off).toBe("4 away");
    expect(gradeProbe(attemptOf(10, [2, 90]), build(), []).detail?.off).toBe("exact");
  });

  it("shows the target in the overlay, unlike an exploration level", () => {
    const grade = gradeProbe(attemptOf(10, [2, 90]), build(), []);
    if (grade.reference.kind !== "param") throw new Error("expected a param overlay");
    expect(grade.reference.target).toBe(10);
    expect(grade.reference.explored).toBe(1);
  });
});

describe("exploration scoring, for a probe with no right answer", () => {
  const level = build({
    config: { ...build().config, scoring: "exploration", exploreFraction: 0.8 },
  });

  it("scores the sweep and nothing else", () => {
    expect(gradeProbe(attemptOf(2, [2, 90]), level, []).score).toBe(1);
    expect(gradeProbe(attemptOf(90, [2, 90]), level, []).score).toBe(1);
    expect(gradeProbe(attemptOf(10, [2, 46]), level, []).score).toBeCloseTo(0.625, 2);
  });

  it("shows no target, so the correction cannot undo the lesson", () => {
    const grade = gradeProbe(attemptOf(50, [2, 90]), level, []);
    if (grade.reference.kind !== "param") throw new Error("expected a param overlay");
    expect(grade.reference.target).toBeNull();
  });
});

describe("the reference attempt", () => {
  it("sweeps, or the winnability guard would fail a correct level", () => {
    const level = build();
    const perfect = perfectProbe(level);
    expect(perfect.visited).toEqual([2, 90]);
    expect(perfect.value).toBe(10);
    expect(gradeProbe(perfect, level, []).stars).toBe(3);
  });

  it("ends anywhere on an exploration level, since there is nowhere right to end", () => {
    const level = build({ config: { ...build().config, scoring: "exploration" } });
    expect(gradeProbe(perfectProbe(level), level, []).stars).toBe(3);
  });

  it("caps stars by hints taken, like every other kind", () => {
    const level = build();
    expect(
      gradeProbe({ ...perfectProbe(level), hintsUsed: 2 }, level, []).stars,
    ).toBe(1);
  });
});

describe("what this grader is allowed to import", () => {
  it("reaches for nothing in lib/ta", () => {
    // `behaviour.ts` is imported eagerly by every level route, so a grader that pulled in the
    // estimators would ship the variance-ratio machinery to /level/1-1. The measurement is a
    // committed artefact the component fetches; the grader only compares two numbers.
    const source = readFileSync("lib/levels/kinds/probe/grade.ts", "utf8");
    const imports = [...source.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]!);
    expect(imports.filter((path) => path.includes("lib/ta"))).toEqual([]);
    expect(imports.filter((path) => path.includes("asset-character"))).toEqual([]);
  });
});
