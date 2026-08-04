import { describe, expect, it } from "vitest";
import { UNDERPOWERED_BELOW } from "@/lib/journal/analytics";
import type { StrategyRun } from "./engine";
import {
  IN_SAMPLE_FRACTION,
  scoreObjective,
  splitOf,
  VARIANT_WARNING_AT,
  variantWarning,
} from "./guards";

/**
 * The three guards, and the asymmetry the data forced on them.
 *
 * The measurement behind every case here: the out-of-sample holdback cannot produce thirty trades on
 * any daily series in the spine — 9 on Bitcoin, 21 on the index, 33 on gold at its most generous
 * lookback. So a verdict of "confirmed" is not available to Chapter 10, and these tests exist mostly
 * to pin that a small sample is *labelled* rather than counted as a failure.
 */

function run(rs: number[]): StrategyRun {
  const totalR = rs.reduce((t, r) => t + r, 0);
  return {
    rs,
    trades: rs.length,
    totalR,
    perTradeR: rs.length === 0 ? 0 : totalR / rs.length,
    hitRate: 0,
    byYear: { "2020": totalR },
    outcomes: rs.map((r, i) => ({
      entryBar: i * 10,
      entryPrice: 100,
      exitBar: i * 10 + 5,
      exitPrice: 100 + r,
      r,
      risk: 1,
      reason: r > 0 ? "target" : "stop",
      gapped: false,
      ambiguous: false,
      finalStop: 99,
    })),
  };
}

const wins = (n: number) => run(Array<number>(n).fill(1));
const losses = (n: number) => run(Array<number>(n).fill(-1));

describe("the forced split", () => {
  it("starts the tuning window where the strategy can produce a signal", () => {
    // A split that ignored the warmup would silently shorten the tuning window and then compare it
    // against a full-length holdback.
    const split = splitOf(1_000, 210);
    expect(split.inSample).toEqual({ from: 210, to: 700 });
    expect(split.later).toEqual({ from: 700, to: 1_000 });
    expect(split.splitBar).toBe(700);
  });

  it("holds back the same share the committed sweep does", () => {
    expect(IN_SAMPLE_FRACTION).toBe(0.7);
    const split = splitOf(4_612, 210);
    expect(split.splitBar).toBe(Math.floor(4_612 * 0.7));
    // The two windows tile the series with no overlap and no gap.
    expect(split.inSample.to).toBe(split.later.from);
    expect(split.later.to).toBe(4_612);
  });
});

describe("the objective, scored per asset", () => {
  it("passes a rule that travels", () => {
    const result = scoreObjective(
      [
        { asset: "SPY-1d", run: wins(30) },
        { asset: "GC-1d", run: wins(30) },
        { asset: "BTCUSDT-1d", run: losses(30) },
      ],
      { minAssetsPassing: 2, minClassesPassing: 2 },
    );
    expect(result.verdict).toBe("passed");
    expect(result.passing).toEqual(["SPY-1d", "GC-1d"]);
    expect(result.failing).toEqual(["BTCUSDT-1d"]);
    expect([...result.classesPassing].sort()).toEqual(["equity", "futures"]);
    expect(result.reason).toContain("2 asset classes");
  });

  it("refuses a one-market strategy however good that market was", () => {
    // **10.7's whole reason for existing.** "Works on one series" would certify overfit strategies
    // as finished work — a BTC-2020-only rule is flagged, not passed.
    const result = scoreObjective(
      [
        { asset: "BTCUSDT-1d", run: run(Array<number>(40).fill(3)) },
        { asset: "SPY-1d", run: losses(40) },
        { asset: "GC-1d", run: losses(40) },
      ],
      { minAssetsPassing: 2, minClassesPassing: 2 },
    );
    expect(result.verdict).toBe("refuted");
    expect(result.passing).toEqual(["BTCUSDT-1d"]);
    // Pooled it is comfortably profitable, which is exactly the sentence 8.5 asks a player to mark.
    expect(result.metrics.pooled.totalR).toBeGreaterThan(0);
  });

  it("counts asset classes rather than markets, so three equities are not diversification", () => {
    const result = scoreObjective(
      [
        { asset: "SPY-1d", run: wins(30) },
        { asset: "AAPL-1d", run: wins(30) },
        { asset: "LAKE-1d", run: wins(30) },
      ],
      { minAssetsPassing: 2, minClassesPassing: 2 },
    );
    expect(result.passing).toHaveLength(3);
    expect(result.classesPassing).toEqual(["equity"]);
    expect(result.verdict).not.toBe("passed");
  });

  it("labels a small sample rather than counting it as a failure", () => {
    // The holdback measurement, as a test. Eleven trades is not a result; calling it one would make
    // the objective a measure of how much history a market happens to have.
    const result = scoreObjective(
      [
        { asset: "SPY-1d", run: wins(11) },
        { asset: "GC-1d", run: losses(9) },
      ],
      { minAssetsPassing: 2 },
    );
    expect(result.verdict).toBe("inconclusive");
    expect(result.inconclusive).toEqual(["SPY-1d", "GC-1d"]);
    expect(result.failing).toEqual([]);
    expect(result.reason).toContain("cannot rule one in");
  });

  it("never says a strategy was confirmed, because the data cannot say it", () => {
    const verdicts = new Set<string>();
    for (const rs of [wins(30), losses(30), wins(5), run([])]) {
      verdicts.add(scoreObjective([{ asset: "SPY-1d", run: rs }], {}).verdict);
    }
    expect([...verdicts].sort()).toEqual(["inconclusive", "passed", "refuted"]);
    expect([...verdicts]).not.toContain("confirmed");
    expect([...verdicts]).not.toContain("validated");
  });

  it("uses the journal's sample-size threshold rather than a second one", () => {
    const justUnder = scoreObjective(
      [{ asset: "SPY-1d", run: wins(UNDERPOWERED_BELOW - 1) }],
      {},
    );
    const justEnough = scoreObjective(
      [{ asset: "SPY-1d", run: wins(UNDERPOWERED_BELOW) }],
      {},
    );
    expect(justUnder.verdict).toBe("inconclusive");
    expect(justEnough.verdict).toBe("passed");
  });

  it("honours a level's own minimum trades over the default", () => {
    // 10.5 asks for thirty, which is more than the journal's twenty. A level must be able to.
    const result = scoreObjective([{ asset: "SPY-1d", run: wins(25) }], {
      minTrades: 30,
    });
    expect(result.verdict).toBe("inconclusive");
    expect(scoreObjective([{ asset: "SPY-1d", run: wins(31) }], { minTrades: 30 }).verdict).toBe(
      "passed",
    );
  });

  it("gives a reason in words on every verdict", () => {
    for (const runs of [
      [{ asset: "SPY-1d", run: wins(30) }],
      [{ asset: "SPY-1d", run: losses(30) }],
      [{ asset: "SPY-1d", run: wins(4) }],
    ]) {
      const { reason } = scoreObjective(runs, {});
      expect(reason.length).toBeGreaterThan(30);
    }
  });

  it("scores nothing as inconclusive rather than as a pass", () => {
    expect(scoreObjective([], { minAssetsPassing: 1 }).verdict).toBe("inconclusive");
  });
});

describe("beating the baseline rather than beating zero", () => {
  // **The measurement that put this option in the module.** On this spine, entering on every flat
  // bar with a 2 ATR stop and a 2R target pays +0.265R a trade on the index, +0.395R on Apple and
  // +0.337R on Bitcoin. "Expectancy > 0" is therefore a bar a random entry clears, and every
  // two-block rule tried during development cleared it.
  const rule = run(Array<number>(40).fill(0.1));
  const generousMarket = run(Array<number>(200).fill(0.3));

  it("fails a positive rule that its own market beat for nothing", () => {
    const result = scoreObjective(
      [{ asset: "SPY-1d", run: rule, baseline: generousMarket }],
      { beatBaseline: true },
    );
    expect(result.metrics.pooled.expectancy).toBeGreaterThan(0);
    expect(result.verdict).toBe("refuted");
    expect(result.reason).toContain("no better than entering on every bar");
  });

  it("passes the same rule when the objective only asks for positive", () => {
    // The two objectives disagreeing on one strategy is the whole point of having both.
    const result = scoreObjective(
      [{ asset: "SPY-1d", run: rule, baseline: generousMarket }],
      {},
    );
    expect(result.verdict).toBe("passed");
  });

  it("passes a rule that genuinely beat doing nothing", () => {
    const result = scoreObjective(
      [
        { asset: "SPY-1d", run: run(Array<number>(40).fill(0.5)), baseline: generousMarket },
      ],
      { beatBaseline: true },
    );
    expect(result.verdict).toBe("passed");
    expect(result.reason).toContain("beat entering on every bar");
  });

  it("reports the baseline per asset, so a reader can check the comparison", () => {
    const result = scoreObjective(
      [{ asset: "SPY-1d", run: rule, baseline: generousMarket }],
      { beatBaseline: true },
    );
    expect(result.baselines).toHaveLength(1);
    expect(result.baselines[0]!.asset).toBe("SPY-1d");
    expect(result.baselines[0]!.trades).toBe(200);
    expect(result.baselines[0]!.perTradeR).toBeCloseTo(0.3, 10);
  });

  it("falls back to the stated minimum when no baseline was measured", () => {
    // A level that asks for the comparison but hands no baseline must not silently pass everything.
    const result = scoreObjective([{ asset: "SPY-1d", run: rule }], {
      beatBaseline: true,
    });
    expect(result.verdict).toBe("passed");
    expect(result.baselines).toEqual([{ asset: "SPY-1d", perTradeR: null, trades: 0 }]);
  });

  it("takes whichever bar is higher when a level asks for both", () => {
    const result = scoreObjective(
      [{ asset: "SPY-1d", run: run(Array<number>(40).fill(0.4)), baseline: generousMarket }],
      { beatBaseline: true, minExpectancy: 0.5 },
    );
    expect(result.verdict).toBe("refuted");
  });
});

describe("the variant counter", () => {
  it("says nothing until tuning starts to cost something", () => {
    expect(variantWarning(1).warn).toBe(false);
    expect(variantWarning(VARIANT_WARNING_AT - 1).message).toBeNull();
  });

  it("warns about the cost rather than forbidding the attempt", () => {
    const warning = variantWarning(VARIANT_WARNING_AT);
    expect(warning.warn).toBe(true);
    // The 9.5 figure, because a warning that cites a measurement teaches and one that scolds does
    // not. And it must not read as a prohibition: a player who keeps going has learned the price.
    expect(warning.message).toContain("25th of 26");
    expect(warning.message).toContain("Nothing stops you");
  });

  it("counts up rather than resetting, so the tenth variant stays the tenth", () => {
    expect(variantWarning(25).count).toBe(25);
    expect(variantWarning(25).warn).toBe(true);
  });
});
