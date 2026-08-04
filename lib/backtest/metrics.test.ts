import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Series, SeriesId } from "@/lib/chart/types";
import { statsForRs, UNDERPOWERED_BELOW } from "@/lib/journal/analytics";
import { breakoutN, specFor } from "@/lib/ta/edges";
import { runStrategy, type StrategyRun } from "./engine";
import { metricsFor, poolMetrics } from "./metrics";

/**
 * What a backtest reports, and what it refuses to report.
 *
 * The arithmetic these tests exercise is `statsForRs`', which has its own suite in
 * `lib/journal/analytics.test.ts`. What is asserted here is the part that would be easy to get
 * wrong precisely because it looks like presentation: that the curve is the running total in trade
 * order, that a small sample is labelled rather than quietly reported, and that pooling never
 * replaces the per-asset figures.
 */

const cache = new Map<string, Series<string>>();
function load(id: SeriesId): Series<string> {
  const hit = cache.get(id);
  if (hit) return hit;
  const loaded = JSON.parse(
    readFileSync(join("public/data/series", `${id}.json`), "utf8"),
  ) as Series<string>;
  cache.set(id, loaded);
  return loaded;
}

const BREAKOUT = specFor(breakoutN(20));
const runOn = (id: SeriesId) => runStrategy(load(id), BREAKOUT);

/** A run with a chosen sequence of outcomes, for the cases real data cannot be asked to produce. */
function fakeRun(rs: number[]): StrategyRun {
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

describe("one asset's metrics", () => {
  it("shares its statistics with the journal rather than recomputing them", () => {
    // The point of the extraction: two callers, one arithmetic. If these ever disagree, the
    // codebase has two answers for expectancy again.
    const run = runOn("SPY-1d");
    const metrics = metricsFor(run);
    const shared = statsForRs(run.rs);
    expect(metrics).toMatchObject(shared);
  });

  it("builds the curve as the running total, in trade order", () => {
    const metrics = metricsFor(fakeRun([2, -1, -1, 2, -1]));
    expect(metrics.equityR).toEqual([2, 1, 0, 2, 1]);
    expect(metrics.equityR.at(-1)).toBeCloseTo(metrics.totalR, 10);
    // The drawdown is a property of that order, not of the set: two down from the peak of 2.
    expect(metrics.maxDrawdownR).toBeCloseTo(2, 10);
    expect(metrics.worstLosingStreak).toBe(2);
  });

  it("counts bars held and the share of exits price gapped through", () => {
    const run = runOn("GC-1d");
    const metrics = metricsFor(run);
    expect(metrics.barsInMarket).toBeGreaterThan(run.trades);
    expect(metrics.gappedShare).toBeGreaterThan(0);
    expect(metrics.gappedShare).toBeLessThan(1);
  });

  it("labels a run too small to conclude from, at the journal's threshold", () => {
    // One threshold for the whole game. A second constant here would let the journal call four
    // trades too few while a backtest called them enough.
    expect(metricsFor(fakeRun(Array(UNDERPOWERED_BELOW - 1).fill(1))).underpowered).toBe(
      true,
    );
    expect(metricsFor(fakeRun(Array(UNDERPOWERED_BELOW).fill(1))).underpowered).toBe(false);
  });

  it("returns zeroes rather than NaN for a strategy that never traded", () => {
    const metrics = metricsFor(fakeRun([]));
    expect(metrics).toMatchObject({ n: 0, totalR: 0, maxDrawdownR: 0, gappedShare: 0 });
    expect(metrics.expectancy).toBeNull();
    expect(metrics.equityR).toEqual([]);
    expect(metrics.underpowered).toBe(true);
  });
});

describe("across assets", () => {
  const runs = [
    { asset: "SPY-1d", run: runOn("SPY-1d") },
    { asset: "GC-1d", run: runOn("GC-1d") },
    { asset: "EURUSD-1d", run: runOn("EURUSD-1d") },
  ];

  it("keeps every asset's figures, because the pooled one hides its composition", () => {
    // 8.5's flawed claim, as a type-level guarantee: "profitable on all six, so the edge is in the
    // rule" is what a pooled-only report invites, and per-trade R spreads fiftyfold.
    const { perAsset, pooled } = poolMetrics(runs);
    expect(perAsset.map((e) => e.asset)).toEqual(["SPY-1d", "GC-1d", "EURUSD-1d"]);
    expect(pooled.n).toBe(perAsset.reduce((t, e) => t + e.metrics.n, 0));
    expect(pooled.totalR).toBeCloseTo(
      perAsset.reduce((t, e) => t + e.metrics.totalR, 0),
      6,
    );
    // And the spread the pooled figure would have hidden is real on this spine.
    const perTrade = perAsset.map((e) => e.metrics.expectancy ?? 0);
    expect(Math.max(...perTrade) - Math.min(...perTrade)).toBeGreaterThan(0.1);
  });

  it("sums the calendar rather than taking one asset's", () => {
    const { pooled } = poolMetrics(runs);
    const years = Object.keys(pooled.byYear);
    expect(years.length).toBeGreaterThan(10);
    const summed = Object.values(pooled.byYear).reduce((t, r) => t + r, 0);
    expect(summed).toBeCloseTo(pooled.totalR, 6);
  });

  it("separates passing from inconclusive rather than calling a small sample a failure", () => {
    // **10.7's objective depends on this distinction.** An asset that took eleven trades has not
    // failed, and counting it as one would make the cross-asset test a measure of how much history
    // a market has rather than of whether the rule travels.
    const { passing, inconclusive } = poolMetrics([
      { asset: "good", run: fakeRun(Array(30).fill(1)) },
      { asset: "bad", run: fakeRun(Array(30).fill(-1)) },
      { asset: "tiny", run: fakeRun([2, 2, 2]) },
    ]);
    expect(passing).toEqual(["good"]);
    expect(inconclusive).toEqual(["tiny"]);
    expect(passing).not.toContain("bad");
    expect(inconclusive).not.toContain("bad");
  });

  it("pools nothing when handed nothing", () => {
    const { perAsset, pooled, passing } = poolMetrics([]);
    expect(perAsset).toEqual([]);
    expect(passing).toEqual([]);
    expect(pooled.n).toBe(0);
    expect(pooled.underpowered).toBe(true);
  });
});
