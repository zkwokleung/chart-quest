import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Series } from "@/lib/chart/types";
import {
  correlation,
  correlationMatrix,
  redundantSignals,
  REDUNDANT_ABOVE,
  signalSeries,
  type SignalId,
} from "./correlation";

function load(id: string): Series<string> {
  return JSON.parse(
    readFileSync(`public/data/series/${id}.json`, "utf8"),
  ) as Series<string>;
}

describe("correlation", () => {
  it("is 1 for a series against itself", () => {
    expect(correlation([1, 2, 3, 4], [1, 2, 3, 4])).toBeCloseTo(1);
  });

  it("is -1 for a series against its negation", () => {
    expect(correlation([1, 2, 3, 4], [-1, -2, -3, -4])).toBeCloseTo(-1);
  });

  it("is unaffected by scale or offset", () => {
    // Which is the point of using it: a correlation between RSI and a percentage return
    // has to mean something despite the two living on different scales.
    expect(correlation([1, 2, 3, 4], [100, 200, 300, 400])).toBeCloseTo(1);
    expect(correlation([1, 2, 3, 4], [11, 12, 13, 14])).toBeCloseTo(1);
  });

  it("ignores bars where either side has no value", () => {
    expect(correlation([null, 1, 2, 3], [9, 1, 2, 3])).toBeCloseTo(1);
    expect(correlation([1, 2, 3, 4], [1, null, 3, 4])).toBeCloseTo(1);
  });

  it("drops a bar for both sides, not just the side that is missing", () => {
    // Pairing has to stay aligned. Skipping index 1 on one side only would correlate
    // a[2] against b[1], which is a subtly wrong number rather than an obvious one — so
    // this checks the count as well as the value.
    expect(correlation([1, 2, 3], [1, null, 3])).toBeNull();
    expect(correlation([9, 1, 2, 3], [null, 1, 2, 3])).toBeCloseTo(1);
  });

  it("returns null rather than NaN when there is nothing to measure", () => {
    // A cell that could not be computed has to be distinguishable from one that came out
    // at zero, because 6.5's reveal displays both.
    expect(correlation([1, 2], [1, 2])).toBeNull();
    expect(correlation([5, 5, 5, 5], [1, 2, 3, 4])).toBeNull();
    expect(correlation([null, null], [1, 2])).toBeNull();
  });

  it("honours a bar range", () => {
    // Rising then falling: correlated over the first half, anti-correlated over the second.
    const a = [1, 2, 3, 4, 5, 6];
    const b = [1, 2, 3, -4, -5, -6];
    expect(correlation(a, b, { from: 0, to: 3 })).toBeCloseTo(1);
    expect(correlation(a, b, { from: 3, to: 6 })).toBeCloseTo(-1);
  });
});

describe("signals", () => {
  const series = load("BTCUSDT-1d");
  const ALL: SignalId[] = [
    "rsi",
    "macd-histogram",
    "price-vs-sma20",
    "sma20-vs-sma50",
    "return-10",
    "range-vs-atr",
  ];

  it.each(ALL)("%s computes a value for most bars", (id) => {
    const values = signalSeries(series, id);
    expect(values).toHaveLength(series.c.length);
    const usable = values.filter((v) => v !== null).length;
    expect(usable / values.length).toBeGreaterThan(0.9);
  });

  it.each(ALL)("%s centres near zero, so a correlation measures co-movement", (id) => {
    // Every signal is a deviation rather than a level. Correlating raw RSI against raw
    // price would mostly measure that both drift, which is not the question 6.5 asks.
    const values = signalSeries(series, id).filter((v): v is number => v !== null);
    const mean = values.reduce((t, v) => t + v, 0) / values.length;
    const spread =
      Math.sqrt(values.reduce((t, v) => t + (v - mean) ** 2, 0) / values.length) || 1;
    // range-vs-atr is a ratio around 1 rather than 0 — the one deliberate exception, since
    // "this bar is 1.4 average ranges wide" is already the comparable form.
    if (id === "range-vs-atr") {
      expect(mean).toBeGreaterThan(0.5);
      expect(mean).toBeLessThan(2);
    } else {
      expect(Math.abs(mean) / spread).toBeLessThan(0.6);
    }
  });

  it("computes MACD with real parameters", () => {
    // Guards a mistake that got as far as a planning document: `macdSeries` takes a params
    // object, and calling it positionally silently yields all nulls — which made MACD look
    // uncorrelated with everything and nearly shipped as 6.5's "independent" claim.
    const values = signalSeries(series, "macd-histogram");
    expect(values.filter((v) => v !== null).length).toBeGreaterThan(1000);
  });
});

describe("the redundancy 6.5 is built on", () => {
  const CLAIMED: SignalId[] = [
    "rsi",
    "price-vs-sma20",
    "return-10",
    "sma20-vs-sma50",
    "range-vs-atr",
  ];
  const REDUNDANT: SignalId[] = ["rsi", "price-vs-sma20", "return-10"];
  const ASSETS = ["BTCUSDT-1d", "SPY-1d", "AAPL-1d"];
  const window = { from: 200, to: 1400 };

  it.each(ASSETS)("%s: the same three signals are the redundant ones", (id) => {
    // The level's answer, recomputed. If this ever changes, 6.5's target is wrong rather
    // than this assertion being inconvenient.
    const matrix = correlationMatrix(load(id), CLAIMED, window);
    expect(redundantSignals(matrix).sort()).toEqual([...REDUNDANT].sort());
  });

  it.each(ASSETS)("%s: the threshold sits in a real gap, not on a knife edge", (id) => {
    const matrix = correlationMatrix(load(id), CLAIMED, window);
    const strongestPartner = (signal: SignalId) => {
      const i = matrix.signals.indexOf(signal);
      return Math.max(
        ...matrix.signals.map((_s, j) =>
          i === j ? 0 : Math.abs(matrix.rows[i]?.[j] ?? 0),
        ),
      );
    };
    const inside = REDUNDANT.map(strongestPartner);
    const outside = CLAIMED.filter((s) => !REDUNDANT.includes(s)).map(strongestPartner);
    expect(Math.min(...inside)).toBeGreaterThan(REDUNDANT_ABOVE * 0.9);
    expect(Math.max(...outside)).toBeLessThan(REDUNDANT_ABOVE);
    // And the gap is wide enough that the exact threshold is not doing the work.
    expect(Math.min(...inside) - Math.max(...outside)).toBeGreaterThan(0.05);
  });

  it("keeps MACD out, because whether it is redundant depends on the market", () => {
    // Recorded as an assertion so the reasoning survives: 0.42 against RSI on Bitcoin and
    // 0.80 against the ten-bar return on SPY. A graded answer cannot rest on that.
    const withMacd: SignalId[] = [...CLAIMED, "macd-histogram"];
    const flagged = ASSETS.map((id) =>
      redundantSignals(correlationMatrix(load(id), withMacd, window)).includes(
        "macd-histogram",
      ),
    );
    expect(new Set(flagged).size).toBe(2);
  });

  it("finds nothing redundant among the signals that are genuinely different", () => {
    const matrix = correlationMatrix(
      load("BTCUSDT-1d"),
      ["sma20-vs-sma50", "range-vs-atr"],
      window,
    );
    expect(redundantSignals(matrix)).toEqual([]);
  });

  it("puts 1 down the diagonal and mirrors across it", () => {
    const matrix = correlationMatrix(load("SPY-1d"), CLAIMED, window);
    for (let i = 0; i < CLAIMED.length; i += 1) {
      expect(matrix.rows[i]?.[i]).toBeCloseTo(1);
      for (let j = 0; j < CLAIMED.length; j += 1) {
        expect(matrix.rows[i]?.[j]).toBeCloseTo(matrix.rows[j]?.[i] ?? NaN);
      }
    }
  });
});
