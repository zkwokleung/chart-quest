import { describe, expect, it } from "vitest";
import type { Attempt, Level } from "../../schema";
import { answersFor, gradeSizingCalc, perfectSizingCalc } from "./grade";

function build(
  positions: Level<"sizing-calc">["config"]["positions"],
  overrides: Partial<Level<"sizing-calc">["config"]> = {},
): Level<"sizing-calc"> {
  return {
    id: "7-3",
    chapter: 7,
    title: "fixture",
    kind: "sizing-calc",
    brief: "fixture",
    data: [],
    config: {
      prompt: "size it",
      equity: 50_000,
      riskPct: 0.01,
      answer: "units",
      positions,
      ...overrides,
    },
    target: {},
    tolerance: { relative: 0.02 },
    stars: [0.5, 0.75, 0.95],
    misconceptions: [
      { id: "a", test: () => false, message: "x" },
      { id: "b", test: () => false, message: "y" },
    ],
    hints: [],
  };
}

const attemptOf = (values: (number | null)[]): Attempt["sizing-calc"] => ({
  kind: "sizing-calc",
  values,
  hintsUsed: 0,
});

const shares = build([{ instrument: "AAPL-1d", entry: 200, stop: 196 }]);

describe("the answer is derived, not authored", () => {
  it("computes it from the account, the stop and the contract terms", () => {
    // $500 of budget over $4 of stop distance, one dollar per point: 125 shares.
    expect(answersFor(shares)[0]?.correct).toBe(125);
  });

  it("changes when the instrument does, with everything else held still", () => {
    // 7.3's premise. Same equity, same risk, same 2% stop — four different answers.
    const four = build([
      { instrument: "BTCUSDT-1d", entry: 50_000, stop: 49_000 },
      { instrument: "AAPL-1d", entry: 200, stop: 196 },
      { instrument: "GC-1d", entry: 1_900, stop: 1_862 },
      { instrument: "EURUSD-1d", entry: 1.1, stop: 1.078 },
    ]);
    const values = answersFor(four).map((a) => a.correct);
    expect(new Set(values).size).toBe(4);
  });

  it("cannot be read out of the level file", () => {
    // `target` is empty on purpose, so there is one source for the answer rather than two
    // that can disagree — the same reasoning `predict-next` uses.
    expect(shares.target).toEqual({});
  });

  it("has perfectAttempt agree with the grader, so the winnability guard means something", () => {
    const grade = gradeSizingCalc(perfectSizingCalc(shares), shares, []);
    expect(grade.score).toBe(1);
    expect(grade.stars).toBe(3);
  });
});

describe("scoring", () => {
  it("accepts an answer inside the relative tolerance", () => {
    // 2% of 125 is 2.5, so 127 passes and 129 does not.
    expect(gradeSizingCalc(attemptOf([127]), shares, []).score).toBe(1);
    expect(gradeSizingCalc(attemptOf([129]), shares, []).score).toBeLessThan(1);
  });

  it("judges error relative to the answer, not absolutely", () => {
    // The reason tolerance is a fraction: being out by 0.001 is nothing on 125 shares and
    // everything on 0.0043 BTC, and one flat number cannot serve both rows of 7.3.
    const btc = build([{ instrument: "BTCUSDT-1d", entry: 50_000, stop: 49_000 }]);
    const answer = answersFor(btc)[0]!.correct;
    expect(gradeSizingCalc(attemptOf([answer * 1.01]), btc, []).score).toBe(1);
    expect(gradeSizingCalc(attemptOf([answer + 0.01]), btc, []).score).toBeLessThan(1);
  });

  it("scores a blank row zero rather than crashing", () => {
    expect(gradeSizingCalc(attemptOf([null]), shares, []).score).toBe(0);
    expect(gradeSizingCalc(attemptOf([]), shares, []).score).toBe(0);
  });

  it("scores each row and takes the mean", () => {
    // Sizing three instruments right and one wrong is a partial skill, and the score says so.
    const four = build([
      { instrument: "BTCUSDT-1d", entry: 50_000, stop: 49_000 },
      { instrument: "AAPL-1d", entry: 200, stop: 196 },
      { instrument: "SPY-1d", entry: 450, stop: 441 },
      { instrument: "EURUSD-1d", entry: 1.1, stop: 1.078 },
    ]);
    const right = answersFor(four).map((a) => a.correct);
    const oneWrong = [...right];
    oneWrong[2] = right[2]! * 3;
    expect(gradeSizingCalc(attemptOf(oneWrong), four, []).score).toBeCloseTo(0.75, 2);
  });

  it("treats a correct answer of zero as exactly zero", () => {
    // Gold at 1% of $50,000 is zero contracts — one contract carries $3,800 of risk against
    // a $500 budget. A real answer, and a ratio cannot express it.
    const gold = build([{ instrument: "GC-1d", entry: 1_900, stop: 1_862 }]);
    expect(answersFor(gold)[0]?.correct).toBe(0);
    expect(gradeSizingCalc(attemptOf([0]), gold, []).score).toBe(1);
    expect(gradeSizingCalc(attemptOf([1]), gold, []).score).toBe(0);
  });

  it("separates a near miss from a wild guess", () => {
    const near = gradeSizingCalc(attemptOf([130]), shares, []).score;
    const wild = gradeSizingCalc(attemptOf([12_500]), shares, []).score;
    expect(near).toBeGreaterThan(wild);
    expect(wild).toBe(0);
  });

  it("gives no credit for the commonest wrong answer", () => {
    // Sizing off the entry price rather than the stop distance: $500 / $200 = 2.5 shares.
    // It is the mistake that makes position size independent of risk, and it must score zero.
    expect(gradeSizingCalc(attemptOf([2.5]), shares, []).score).toBe(0);
  });

  it("gives no credit for ignoring the contract multiplier", () => {
    // On gold, treating a point as a dollar gives 13 instead of 0 — a position carrying
    // $49,400 of risk against a $500 budget.
    const gold = build([{ instrument: "GC-1d", entry: 1_900, stop: 1_862 }]);
    expect(gradeSizingCalc(attemptOf([13]), gold, []).score).toBe(0);
  });

  it("caps stars by hints taken, like every other kind", () => {
    const grade = gradeSizingCalc(
      { ...perfectSizingCalc(shares), hintsUsed: 2 },
      shares,
      [],
    );
    expect(grade.score).toBe(1);
    expect(grade.stars).toBe(1);
  });
});

describe("what the score card shows", () => {
  it("reports how many rows were right and what the budget was", () => {
    const grade = gradeSizingCalc(perfectSizingCalc(shares), shares, []);
    expect(grade.detail?.correct).toBe("1 of 1");
    expect(grade.detail?.["risk budget"]).toBe(500);
  });

  it("shows the answer and what it actually risks, per row", () => {
    const grade = gradeSizingCalc(attemptOf([100]), shares, []);
    if (grade.reference.kind !== "sizing") throw new Error("expected a sizing overlay");
    expect(grade.reference.correct).toEqual([125]);
    expect(grade.reference.submitted).toEqual([100]);
    // 125 shares at $4 of risk is the full $500 budget.
    expect(grade.reference.risked[0]).toBeCloseTo(500);
  });
});

describe("asking for the money instead of the size", () => {
  const money = build([{ instrument: "GC-1d", entry: 1_900, stop: 1_880 }], {
    answer: "riskCurrency",
  });

  it("asks what the rounded position actually risks", () => {
    // One contract over $20 of stop distance at $100 a point is $2,000 — four times the
    // budget, so the rounded position is zero contracts and risks nothing.
    expect(answersFor(money)[0]?.correct).toBe(0);
  });

  it("still grades through the same path", () => {
    expect(gradeSizingCalc(perfectSizingCalc(money), money, []).score).toBe(1);
  });
});
