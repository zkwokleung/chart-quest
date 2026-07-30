import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Series } from "@/lib/chart/types";
import { atr, atrFraction, trueRange } from "./atr";

function build(
  bars: [o: number, h: number, l: number, c: number][],
): Series<string> {
  return {
    id: "FIXTURE-1d",
    tf: "1d",
    t: bars.map((_, i) => Date.UTC(2020, 0, i + 1)),
    o: bars.map((b) => b[0]),
    h: bars.map((b) => b[1]),
    l: bars.map((b) => b[2]),
    c: bars.map((b) => b[3]),
    v: bars.map(() => 1000),
  };
}

describe("trueRange", () => {
  it("is high minus low for the first bar, which has no previous close", () => {
    expect(trueRange(build([[100, 110, 90, 105]]), 0)).toBe(20);
  });

  it("is high minus low when the bar sits inside the previous close", () => {
    const series = build([
      [100, 110, 90, 100],
      [100, 105, 95, 102],
    ]);
    expect(trueRange(series, 1)).toBe(10);
  });

  it("counts the gap when a bar opens away from the previous close", () => {
    // The whole reason true range is not just high minus low: this bar moved 20
    // from the last close, and only 10 of it is visible in its own range.
    const series = build([
      [100, 110, 90, 100],
      [80, 90, 80, 85],
    ]);
    expect(trueRange(series, 1)).toBe(20);
  });

  it("counts an upward gap too", () => {
    const series = build([
      [100, 110, 90, 100],
      [120, 125, 118, 122],
    ]);
    expect(trueRange(series, 1)).toBe(25);
  });

  it("is zero for a bar that does not exist", () => {
    expect(trueRange(build([[100, 110, 90, 105]]), 7)).toBe(0);
  });
});

describe("atr", () => {
  it("averages true range over the window ending at the index", () => {
    const series = build([
      [100, 110, 100, 105],
      [105, 115, 105, 110],
      [110, 120, 110, 115],
    ]);
    // Ranges 10, 10, 10 — with no gaps, since each bar opens at the last close.
    expect(atr(series, 2, 3)).toBeCloseTo(10);
  });

  it("returns 0 rather than a partial average when the window runs off the front", () => {
    // "No estimate" and "no volatility" are different claims, and a stop grader
    // dividing by the second would silently pass anything.
    const series = build([
      [100, 110, 100, 105],
      [105, 115, 105, 110],
    ]);
    expect(atr(series, 1, 14)).toBe(0);
    expect(atr(series, 1, 2)).toBeGreaterThan(0);
  });

  it("returns 0 for a nonsensical period", () => {
    const series = build([[100, 110, 100, 105]]);
    expect(atr(series, 0, 0)).toBe(0);
    expect(atr(series, 0, -5)).toBe(0);
  });

  it("matches the value the boss window was authored against", () => {
    // BTC-4h bar 4819 is 3.B's retest bar. The planning search measured its ATR at
    // ~944, and every stop tolerance in the level is a multiple of it — so if this
    // number moves, the level's grading moves with it.
    const btc = JSON.parse(
      readFileSync("public/data/series/BTCUSDT-4h.json", "utf8"),
    ) as Series<string>;
    expect(atr(btc, 4819, 14)).toBeCloseTo(944, 0);
  });
});

describe("atrFraction", () => {
  it("expresses volatility as a share of price, so assets compare", () => {
    const series = build([
      [100, 110, 100, 105],
      [105, 115, 105, 110],
      [110, 120, 110, 100],
    ]);
    // Last close 100, ATR 10 → 10%.
    expect(atrFraction(series, 2, 3)).toBeCloseTo(0.1);
  });

  it("shows Bitcoin as the more volatile market, in its own units", () => {
    // The Chapter 5 lesson, checked against real data: 4h Bitcoin in March 2023
    // against daily SPY in a calm stretch. The point is that the comparison is
    // possible at all once volatility is a fraction rather than a price.
    const btc = JSON.parse(
      readFileSync("public/data/series/BTCUSDT-4h.json", "utf8"),
    ) as Series<string>;
    const spy = JSON.parse(
      readFileSync("public/data/series/SPY-1d.json", "utf8"),
    ) as Series<string>;
    expect(atrFraction(btc, 4819, 14)).toBeGreaterThan(
      atrFraction(spy, 3300, 14),
    );
  });
});
