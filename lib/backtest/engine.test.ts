import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Series, SeriesId } from "@/lib/chart/types";
import { breakoutN, runEdge, specFor, WARMUP } from "@/lib/ta/edges";
import { runStrategy, type StrategySpec } from "./engine";

/**
 * The engine's two hard rules, and the adapter that keeps two published artefacts honest.
 *
 * Issue #28 asks for no look-ahead and no fill at a price the market never traded at. The second is
 * `simulate`'s and already has its own tests; what is asserted here is that it still holds *through
 * the engine*, because a loop can undo a fill rule by choosing the wrong bar to ask about.
 *
 * The first is asserted by **prefix invariance** rather than by spying on array reads. A Proxy over
 * the series cannot distinguish the two kinds of forward read the engine legitimately makes — the
 * decision at bar `i` must not look past `i`, but `simulate` walks bars after the entry by design.
 * Truncating the series draws that line exactly: if a decision peeked, removing the bars it peeked
 * at would change a trade that had already closed. Nothing has to be instrumented.
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

type Bar = [open: number, high: number, low: number, close: number];

/** A synthetic series, so a single bar's behaviour can be stated rather than found. */
function synthetic(bars: Bar[]): Series<string> {
  return {
    id: "test",
    tf: "1d",
    t: bars.map((_, i) => Date.UTC(2020, 0, 1) + i * 864e5),
    o: bars.map((b) => b[0]),
    h: bars.map((b) => b[1]),
    l: bars.map((b) => b[2]),
    c: bars.map((b) => b[3]),
    v: bars.map(() => 1),
  };
}

/** Truncated to `bars`, which is what prefix invariance compares against. */
function prefix(series: Series<string>, bars: number): Series<string> {
  return {
    ...series,
    t: series.t.slice(0, bars),
    o: series.o.slice(0, bars),
    h: series.h.slice(0, bars),
    l: series.l.slice(0, bars),
    c: series.c.slice(0, bars),
    v: series.v.slice(0, bars),
  };
}

const BREAKOUT = specFor(breakoutN(20));

/**
 * Enters once, at bar 20, so a synthetic series can isolate one fill.
 *
 * Twenty flat bars of range 2 give an ATR of 2, so a 1-ATR stop sits 2 away from the entry of 100
 * and each 1R is worth 2 points. Every synthetic case below rests on that arithmetic.
 */
const ONCE: StrategySpec = {
  entry: (_series, i) => i === 20,
  side: "long",
  stop: { kind: "atr", multiple: 1, period: 14 },
  target: { kind: "r", multiple: 2 },
  timeStopBars: 10,
  warmup: 20,
};

/** Twenty-one bars of 100 ±1, then whatever the case needs. */
function flatThen(...rest: Bar[]): Series<string> {
  const bars: Bar[] = Array.from({ length: 21 }, () => [100, 101, 99, 100]);
  return synthetic([...bars, ...rest]);
}

const repeat = (bar: Bar, times: number): Bar[] =>
  Array.from({ length: times }, () => bar);

describe("no look-ahead", () => {
  it("leaves every already-closed trade identical when the future is removed", () => {
    // **The rule, stated as the only thing it can mean.** A decision at bar i that read bar i+50
    // would produce a different trade once bar i+50 is gone, so every trade that closed before the
    // cut must survive the cut untouched.
    const series = load("SPY-1d");
    const full = runStrategy(series, BREAKOUT);
    const cut = 2_000;
    const truncated = runStrategy(prefix(series, cut), BREAKOUT);

    // Only trades whose whole life fits inside the truncated series are comparable: the engine
    // stops `timeStopBars` short of the end, so the last few of the full run have no counterpart.
    const comparable = full.outcomes.filter(
      (outcome) => outcome.exitBar < cut - BREAKOUT.timeStopBars - 1,
    );
    expect(comparable.length).toBeGreaterThan(20);
    expect(truncated.outcomes.slice(0, comparable.length)).toEqual(comparable);
  });

  it("asks its entry predicate only about bars it is allowed to decide on", () => {
    const series = load("GC-1d");
    const asked: number[] = [];
    const run = runStrategy(
      series,
      { ...BREAKOUT, entry: (s, i) => (asked.push(i), BREAKOUT.entry(s, i)) },
      { from: 500, to: 1_500 },
    );

    expect(asked.length).toBeGreaterThan(100);
    expect(Math.min(...asked)).toBeGreaterThanOrEqual(500);
    expect(Math.max(...asked)).toBeLessThan(1_500);
    // Strictly forward, never revisited: a rule asked twice about one bar is a loop that could
    // enter the same move twice.
    expect([...asked].sort((a, b) => a - b)).toEqual(asked);
    expect(new Set(asked).size).toBe(asked.length);
    expect(run.trades).toBeGreaterThan(0);
  });
});

describe("fills the market could have given", () => {
  it("fills at the open when price gapped through the stop, not at the stop", () => {
    // Stop at 98, and the next bar opens at 90 — through it. The fill has to be the 90 that traded.
    const run = runStrategy(flatThen(...repeat([90, 91, 89, 90], 13)), ONCE);
    expect(run.trades).toBe(1);
    const trade = run.outcomes[0]!;
    expect(trade.gapped).toBe(true);
    expect(trade.exitPrice).toBe(90);
    // −5R, not the −1R the stop promised. 1.6's lesson, surviving the engine.
    expect(trade.r).toBeCloseTo(-5, 6);
  });

  it("scores a bar containing both the stop and the target as a stop", () => {
    // Entry 100, stop 98, target 104, and one bar spanning both. Six OHLC numbers cannot say which
    // came first, and resolving it optimistically is how a backtest quietly inflates everything.
    const trade = runStrategy(
      flatThen([100, 105, 97, 100], ...repeat([100, 101, 99, 100], 12)),
      ONCE,
    ).outcomes[0]!;
    expect(trade.reason).toBe("stop");
    expect(trade.ambiguous).toBe(true);
    expect(trade.r).toBeCloseTo(-1, 6);
  });

  it("closes at the last close when the clock runs out", () => {
    const trade = runStrategy(
      flatThen(...repeat([100, 101, 99, 101], 13)),
      ONCE,
    ).outcomes[0]!;
    expect(trade.reason).toBe("time");
    expect(trade.r).toBeCloseTo(0.5, 6);
  });

  it("shorts the mirror of what it longs", () => {
    // A symmetry check rather than a lesson: the sign conventions in `simulate` are easy to invert,
    // and Chapter 10 lets a player choose a side.
    const bars = flatThen(...repeat([96, 97, 95, 96], 12));
    expect(runStrategy(bars, { ...ONCE, side: "short" }).outcomes[0]!.r).toBeGreaterThan(0);
    expect(runStrategy(bars, ONCE).outcomes[0]!.r).toBeLessThan(0);
  });
});

describe("the sequential loop", () => {
  it("never holds two positions at once", () => {
    const run = runStrategy(load("AAPL-1d"), BREAKOUT);
    expect(run.trades).toBeGreaterThan(50);
    for (let i = 1; i < run.outcomes.length; i += 1) {
      expect(run.outcomes[i]!.entryBar).toBeGreaterThan(run.outcomes[i - 1]!.exitBar);
    }
  });

  it("starts no earlier than the warmup, and its years sum to its total", () => {
    const run = runStrategy(load("SPY-1d"), BREAKOUT);
    expect(run.outcomes[0]!.entryBar).toBeGreaterThanOrEqual(WARMUP);
    const summed = Object.values(run.byYear).reduce((total, r) => total + r, 0);
    expect(summed).toBeCloseTo(run.totalR, 6);
  });

  it("reports a target-free strategy's hit rate as zero rather than as a lie", () => {
    const run = runStrategy(load("SPY-1d"), { ...BREAKOUT, target: { kind: "none" } });
    expect(run.trades).toBeGreaterThan(0);
    expect(run.hitRate).toBe(0);
    // Every trade ends at the stop or the clock, so none can be a target hit.
    expect(run.outcomes.every((outcome) => outcome.reason !== "target")).toBe(true);
  });

  it("returns an empty run rather than throwing on a series shorter than its warmup", () => {
    const run = runStrategy(synthetic(repeat([100, 101, 99, 100], 30)), BREAKOUT);
    expect(run).toMatchObject({ trades: 0, totalR: 0, perTradeR: 0, hitRate: 0 });
    expect(run.byYear).toEqual({});
  });
});

describe("runEdge, as an adapter", () => {
  it("returns exactly what the engine computed, minus the outcomes", () => {
    // The artefact drift tests are the real gate on this refactor; this is the cheap version that
    // says which of the two sides moved when they disagree.
    const edge = breakoutN(20);
    for (const id of ["SPY-1d", "BTCUSDT-1d", "EURUSD-1d"] as const) {
      const series = load(id);
      const viaEngine = runStrategy(series, specFor(edge));
      expect(runEdge(series, edge), id).toEqual({
        rs: viaEngine.rs,
        trades: viaEngine.trades,
        totalR: viaEngine.totalR,
        perTradeR: viaEngine.perTradeR,
        hitRate: viaEngine.hitRate,
        byYear: viaEngine.byYear,
      });
    }
  });

  it("honours a window, which is what the sweep is built on", () => {
    const series = load("GC-1d");
    const edge = breakoutN(11);
    const early = runEdge(series, edge, { from: 0, to: 2_000 });
    const late = runEdge(series, edge, { from: 2_000, to: series.c.length });
    expect(early.trades).toBeGreaterThan(0);
    expect(late.trades).toBeGreaterThan(0);
    // Two windows cannot produce more trades than the whole, give or take the one straddling the
    // boundary that neither window can hold.
    expect(early.trades + late.trades).toBeLessThanOrEqual(
      runEdge(series, edge).trades + 1,
    );
  });
});
