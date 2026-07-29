import { describe, expect, it } from "vitest";
import type { Attempt, Level } from "../../schema";
import { gradeClassify, perfectClassify } from "./grade";

function level(
  correct: string[],
  multiple = false,
  optionCount = 4,
): Level<"classify"> {
  return {
    id: "1-6",
    chapter: 1,
    title: "test",
    kind: "classify",
    brief: "test",
    data: [{ series: "SPY-1d", from: 0, to: 20 }],
    config: {
      prompt: "?",
      multiple,
      options: Array.from({ length: optionCount }, (_, i) => ({
        id: String.fromCharCode(97 + i),
        label: `option ${i}`,
      })),
    },
    target: { correct },
    tolerance: {},
    stars: [0.4, 0.7, 0.9],
    misconceptions: [
      {
        id: "picked-btc-gap",
        test: (a) => a.selected.includes("b"),
        message: "BTC trades 24/7, so the gap you are looking at is SPY's.",
      },
      { id: "other", test: () => false, message: "other" },
    ],
    hints: [],
  };
}

function attempt(selected: string[], hintsUsed = 0): Attempt["classify"] {
  return { kind: "classify", selected, hintsUsed };
}

describe("gradeClassify single-select", () => {
  it("scores an exact answer perfectly", () => {
    const grade = gradeClassify(attempt(["a"]), level(["a"]), []);
    expect(grade.score).toBe(1);
    expect(grade.stars).toBe(3);
  });

  it("scores a wrong answer zero", () => {
    expect(gradeClassify(attempt(["c"]), level(["a"]), []).score).toBe(0);
  });

  it("gives no credit for selecting everything", () => {
    // On a single-select question, ticking every option is not a partial answer.
    expect(gradeClassify(attempt(["a", "b", "c", "d"]), level(["a"]), []).score).toBe(0);
  });

  it("scores an empty answer zero", () => {
    expect(gradeClassify(attempt([]), level(["a"]), []).score).toBe(0);
  });

  it("names the misconception behind a specific wrong answer", () => {
    // The point of the whole design: a wrong answer produces an explanation, not
    // just a number.
    const grade = gradeClassify(attempt(["b"]), level(["a"]), []);
    expect(grade.diagnosis.map((d) => d.id)).toEqual(["picked-btc-gap"]);
    expect(grade.diagnosis[0]?.message).toMatch(/24\/7/);
  });

  it("reports the correct and chosen options for the overlay", () => {
    const grade = gradeClassify(attempt(["c"]), level(["a"]), []);
    expect(grade.reference).toEqual({ kind: "options", correct: ["a"], chosen: ["c"] });
  });

  it("caps stars when hints were taken", () => {
    expect(gradeClassify(attempt(["a"], 2), level(["a"]), []).stars).toBe(1);
  });
});

describe("gradeClassify multi-select", () => {
  it("scores an exact set perfectly", () => {
    expect(gradeClassify(attempt(["a", "b"]), level(["a", "b"], true), []).score).toBe(1);
  });

  it("gives partial credit for a partial set", () => {
    const grade = gradeClassify(attempt(["a"]), level(["a", "b"], true), []);
    expect(grade.score).toBeCloseTo(2 / 3, 5);
  });

  it("punishes ticking every option", () => {
    const grade = gradeClassify(
      attempt(["a", "b", "c", "d"]),
      level(["a"], true),
      [],
    );
    expect(grade.score).toBeLessThan(0.5);
  });
});

describe("perfectClassify", () => {
  it("reproduces the target and scores three stars", () => {
    const lvl = level(["a", "b"], true);
    expect(gradeClassify(perfectClassify(lvl), lvl, []).stars).toBe(3);
  });

  it("does not alias the level's target array", () => {
    const lvl = level(["a"]);
    perfectClassify(lvl).selected.push("z");
    expect(lvl.target.correct).toEqual(["a"]);
  });
});
