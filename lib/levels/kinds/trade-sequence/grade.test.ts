import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Series } from "@/lib/chart/types";
import type { Attempt, Level } from "../../schema";
import { gradeTradeSequence, perfectTradeSequence, runSequence } from "./grade";

const gold = JSON.parse(
  readFileSync("public/data/series/GC-1d.json", "utf8"),
) as Series<string>;

/**
 * A five-trade fixture over real bars.
 *
 * Outcomes come from `simulate` over the committed series rather than being written here, so
 * these tests check the *scoring* — which is the part with judgement in it. What each trade
 * returned is the data's business.
 */
function build(
  trades: Level<"trade-sequence">["config"]["trades"],
  overrides: Partial<Level<"trade-sequence">> = {},
): Level<"trade-sequence"> {
  return {
    id: "7-B",
    chapter: 7,
    title: "fixture",
    kind: "trade-sequence",
    brief: "fixture",
    data: [{ series: "GC-1d", from: 3000, to: 3400 }],
    config: {
      prompt: "size them",
      setup: "reversal",
      equity: 25_000,
      trades,
      riskChoices: [0.005, 0.01, 0.02, 0.05, 0.1],
      maxBars: 60,
    },
    target: {},
    tolerance: { maxRiskPct: 0.02, ruinBelow: 0.5 },
    stars: [0.5, 0.75, 0.95],
    misconceptions: [
      { id: "a", test: () => false, message: "x" },
      { id: "b", test: () => false, message: "y" },
    ],
    hints: [],
    ...overrides,
  };
}

/** Five bars far enough apart not to overlap, with stops a little under the low. */
const TRADES = [3050, 3100, 3150, 3200, 3250].map((bar) => ({
  bar,
  stop: gold.l[bar]! * 0.98,
  targetR: 2,
}));

const level = build(TRADES);
const attemptOf = (risks: number[]): Attempt["trade-sequence"] => ({
  kind: "trade-sequence",
  risks,
  hintsUsed: 0,
});

describe("the outcomes are the data's, not the level's", () => {
  it("derives each trade's R from simulate over the committed series", () => {
    const run = runSequence(attemptOf([0.01, 0.01, 0.01, 0.01, 0.01]), level, [gold]);
    expect(run.steps).toHaveLength(5);
    for (const step of run.steps) {
      expect(Number.isFinite(step.r)).toBe(true);
      // A 2R target and a stop below entry bounds every outcome in the usual range.
      expect(step.r).toBeGreaterThan(-3);
      expect(step.r).toBeLessThanOrEqual(2.5);
    }
  });

  it("authors no target, so the sequence cannot drift from the data", () => {
    expect(level.target).toEqual({});
  });

  it("gives a correct running account for a partly-sized sequence", () => {
    // The contract `TradeSequence` leans on to show the account mid-play. It used to read the
    // running equity off `grade`, which is null until all ten are committed, so every decision
    // was offered against the starting balance and the level's own prompt was false.
    //
    // Steps past the decided prefix carry a real R at zero risk, which is why the component
    // slices — asserted here so a future change that made them meaningful would be noticed.
    const partial = runSequence(attemptOf([0.02, 0.02]), level, [gold]);
    const full = runSequence(attemptOf([0.02, 0.02, 0.01, 0.01, 0.01]), level, [gold]);

    expect(partial.steps.slice(0, 2).map((s) => s.equity)).toEqual(
      full.steps.slice(0, 2).map((s) => s.equity),
    );
    expect(partial.steps[1]!.equity).not.toBe(25_000);
    for (const step of partial.steps.slice(2)) {
      expect(step.risk).toBe(0);
      expect(step.equity).toBe(partial.steps[1]!.equity);
    }
  });

  it("compounds on the running account, not the starting one", () => {
    // The whole reason a losing streak is survivable at a small fraction: each trade risks a
    // slice of what is left. Risking a slice of the original would remove the lesson.
    const flat = runSequence(attemptOf([0.1, 0.1, 0.1, 0.1, 0.1]), level, [gold]);
    let manual = 25_000;
    for (const step of flat.steps) manual *= 1 + step.r * step.risk;
    expect(flat.steps.at(-1)!.equity).toBeCloseTo(manual, 6);
  });
});

describe("scoring is on process, because the outcomes are fixed", () => {
  it("gives the disciplined reference three stars", () => {
    // The winnability guard leans on this, and `perfectAttempt` deliberately uses the *largest*
    // defensible risk rather than the smallest — a reference of "risk almost nothing" would pass
    // while teaching that the safest play is not to trade.
    const grade = gradeTradeSequence(perfectTradeSequence(level), level, [gold]);
    expect(grade.stars).toBe(3);
    expect(perfectTradeSequence(level).risks.every((r) => r === 0.02)).toBe(true);
  });

  it("penalises risk above the defensible cap", () => {
    const reckless = gradeTradeSequence(attemptOf([0.1, 0.1, 0.1, 0.1, 0.1]), level, [gold]);
    const sane = gradeTradeSequence(attemptOf([0.02, 0.02, 0.02, 0.02, 0.02]), level, [gold]);
    expect(reckless.score).toBeLessThan(sane.score);
    expect(reckless.detail?.["trades sized sanely"]).toBe("0 of 5");
  });

  it("names raising risk after a loss, per trade", () => {
    // The martingale, and the specific error that turns a streak into a wiped account. Scored
    // separately from restraint so the correction can point at the exact decision.
    const run = runSequence(attemptOf([0.01, 0.01, 0.01, 0.01, 0.01]), level, [gold]);
    const firstLoss = run.steps.findIndex((s) => s.r < 0);
    if (firstLoss < 0 || firstLoss + 1 >= run.steps.length) return;

    const escalating = [0.01, 0.01, 0.01, 0.01, 0.01];
    escalating[firstLoss + 1] = 0.02;
    const grade = gradeTradeSequence(attemptOf(escalating), level, [gold]);
    if (grade.reference.kind !== "sequence") throw new Error("expected a sequence overlay");
    expect(grade.reference.escalations).toContain(firstLoss + 1);
    expect(grade.detail?.["raised risk after a loss"]).toBe(1);
  });

  it("does not call it escalation when risk goes up after a win", () => {
    const run = runSequence(attemptOf([0.01, 0.01, 0.01, 0.01, 0.01]), level, [gold]);
    const firstWin = run.steps.findIndex((s) => s.r > 0);
    if (firstWin < 0 || firstWin + 1 >= run.steps.length) return;

    const rising = [0.01, 0.01, 0.01, 0.01, 0.01];
    rising[firstWin + 1] = 0.02;
    const grade = gradeTradeSequence(attemptOf(rising), level, [gold]);
    if (grade.reference.kind !== "sequence") throw new Error("expected a sequence overlay");
    expect(grade.reference.escalations).not.toContain(firstWin + 1);
  });

  it("treats an account through the floor as the one unrecoverable outcome", () => {
    // Survival is a gate rather than a gradient, which is why it carries the largest weight.
    const wiped = build(TRADES, { tolerance: { maxRiskPct: 0.02, ruinBelow: 0.999 } });
    const grade = gradeTradeSequence(attemptOf([0.02, 0.02, 0.02, 0.02, 0.02]), wiped, [gold]);
    if (grade.reference.kind !== "sequence") throw new Error("expected a sequence overlay");
    // With a ruin line just under the starting account, any losing trade trips it.
    if (grade.reference.steps.some((s) => s.r < 0)) {
      expect(grade.reference.ruined).toBe(true);
      expect(grade.score).toBeLessThanOrEqual(0.6);
    }
  });

  it("scores an unsized trade as unanswered rather than as restraint", () => {
    // Leaving a trade blank is not discipline. Restraint counts against every trade the level
    // asked about, not only the ones the player answered.
    const partial = gradeTradeSequence(attemptOf([0.02, 0.02]), level, [gold]);
    expect(partial.detail?.["trades sized sanely"]).toBe("2 of 5");
    expect(partial.score).toBeLessThan(1);
  });

  it("reports what is left of the account", () => {
    const grade = gradeTradeSequence(perfectTradeSequence(level), level, [gold]);
    expect(String(grade.detail?.["account left"])).toMatch(/^\d+%$/);
  });

  it("caps stars by hints taken, like every other kind", () => {
    const grade = gradeTradeSequence(
      { ...perfectTradeSequence(level), hintsUsed: 2 },
      level,
      [gold],
    );
    expect(grade.stars).toBe(1);
  });

  it("separates discipline from luck", () => {
    // The property that makes this a Chapter 7 boss rather than a P&L contest: the same fixed
    // outcomes, sized two ways, score differently — and the reckless run scores worse even if
    // it happens to end richer.
    const sane = gradeTradeSequence(attemptOf([0.02, 0.02, 0.02, 0.02, 0.02]), level, [gold]);
    const reckless = gradeTradeSequence(attemptOf([0.1, 0.1, 0.1, 0.1, 0.1]), level, [gold]);
    if (sane.reference.kind !== "sequence" || reckless.reference.kind !== "sequence") {
      throw new Error("expected sequence overlays");
    }
    // Identical R sequences — only the sizing differs.
    expect(reckless.reference.steps.map((s) => s.r)).toEqual(
      sane.reference.steps.map((s) => s.r),
    );
    expect(sane.score).toBeGreaterThan(reckless.score);
  });
});
