import { describe, expect, it, vi } from "vitest";
import type { Series } from "@/lib/chart/types";
import { diagnose, f1, starCap, starsFor } from "./grade";
import type { Attempt, Level, Misconception } from "./schema";

const THRESHOLDS: [number, number, number] = [0.4, 0.7, 0.9];

function classifyLevel(
  misconceptions: Misconception<"classify">[] = [],
): Level<"classify"> {
  return {
    id: "1-2",
    chapter: 1,
    title: "test",
    kind: "classify",
    brief: "test",
    data: [{ series: "BTCUSDT-1d", from: 0, to: 10 }],
    config: { prompt: "?", options: [{ id: "a", label: "A" }] },
    target: { correct: ["a"] },
    tolerance: {},
    stars: THRESHOLDS,
    misconceptions,
    hints: [],
  };
}

const attempt: Attempt["classify"] = { kind: "classify", selected: ["b"], hintsUsed: 0 };
const noData: Series<string>[] = [];

describe("starsFor", () => {
  it("awards stars by threshold", () => {
    expect(starsFor(0.95, THRESHOLDS, 0)).toBe(3);
    expect(starsFor(0.7, THRESHOLDS, 0)).toBe(2);
    expect(starsFor(0.4, THRESHOLDS, 0)).toBe(1);
    expect(starsFor(0.39, THRESHOLDS, 0)).toBe(0);
  });

  it("treats a threshold as inclusive", () => {
    expect(starsFor(0.9, THRESHOLDS, 0)).toBe(3);
  });

  it("caps stars by hints taken", () => {
    // A perfect answer after one hint is worth two stars, not three. This is the
    // only thing making hints cost anything.
    expect(starsFor(1, THRESHOLDS, 1)).toBe(2);
    expect(starsFor(1, THRESHOLDS, 2)).toBe(1);
    expect(starsFor(1, THRESHOLDS, 3)).toBe(0);
  });

  it("never lets the cap raise a low score", () => {
    expect(starsFor(0.1, THRESHOLDS, 0)).toBe(0);
    expect(starsFor(0.5, THRESHOLDS, 1)).toBe(1);
  });

  it("clamps nonsense hint counts instead of going negative", () => {
    expect(starsFor(1, THRESHOLDS, 99)).toBe(0);
    expect(starsFor(1, THRESHOLDS, -5)).toBe(3);
  });
});

describe("starCap", () => {
  it("prices a hint before it is taken", () => {
    expect(starCap(0)).toBe(3);
    expect(starCap(1)).toBe(2);
    expect(starCap(4)).toBe(0);
  });
});

describe("diagnose", () => {
  it("returns matches in author order", () => {
    const level = classifyLevel([
      { id: "narrow", test: () => true, message: "narrow" },
      { id: "broad", test: () => true, message: "broad" },
    ]);
    expect(diagnose(attempt, level, noData).map((m) => m.id)).toEqual([
      "narrow",
      "broad",
    ]);
  });

  it("omits tests that do not match", () => {
    const level = classifyLevel([
      { id: "no", test: () => false, message: "no" },
      { id: "yes", test: () => true, message: "yes" },
    ]);
    expect(diagnose(attempt, level, noData).map((m) => m.id)).toEqual(["yes"]);
  });

  it("skips a throwing test rather than losing the attempt", () => {
    // A broken diagnosis should cost the player an explanation, not their answer.
    const level = classifyLevel([
      {
        id: "broken",
        test: () => {
          throw new Error("author bug");
        },
        message: "broken",
      },
      { id: "fine", test: () => true, message: "fine" },
    ]);
    expect(() => diagnose(attempt, level, noData)).not.toThrow();
    expect(diagnose(attempt, level, noData).map((m) => m.id)).toEqual(["fine"]);
  });

  it("passes the attempt, level and data through to the test", () => {
    const spy = vi.fn(() => false);
    const level = classifyLevel([{ id: "s", test: spy, message: "m" }]);
    diagnose(attempt, level, noData);
    expect(spy).toHaveBeenCalledWith(attempt, level, noData);
  });
});

describe("f1", () => {
  it("is 1 for an exact match", () => {
    expect(f1(3, 3, 3)).toBe(1);
  });

  it("punishes over-selection", () => {
    // Marking everything must not win. With 3 targets among 100 marks the score
    // has to collapse, or "select all" is a strategy.
    expect(f1(3, 3, 100)).toBeLessThan(0.1);
  });

  it("punishes under-selection", () => {
    expect(f1(1, 3, 1)).toBeCloseTo(0.5, 5);
  });

  it("is 0 with no hits", () => {
    expect(f1(0, 3, 5)).toBe(0);
  });

  it("is 1 when nothing was expected and nothing was given", () => {
    expect(f1(0, 0, 0)).toBe(1);
  });
});
