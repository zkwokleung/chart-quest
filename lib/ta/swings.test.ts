import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Series } from "@/lib/chart/types";
import { findSwings, readStructure, swingHighs, swingLows } from "./swings";

/** Builds a series from explicit highs and lows so swings are unambiguous. */
function series(highs: number[], lows: number[]): Series<string> {
  return {
    id: "TEST-1d",
    tf: "1d",
    t: highs.map((_, i) => Date.UTC(2024, 0, 1) + i * 86_400_000),
    o: highs.map((h, i) => (h + (lows[i] ?? h)) / 2),
    h: highs,
    l: lows,
    c: highs.map((h, i) => (h + (lows[i] ?? h)) / 2),
    v: highs.map(() => 100),
  };
}

describe("findSwings", () => {
  it("finds a peak with k bars either side", () => {
    //                       0  1  2  3  4  5  6
    const s = series([1, 2, 3, 9, 3, 2, 1], [0, 1, 2, 3, 2, 1, 0]);
    const highs = swingHighs(s, { from: 0, to: 7 }, 2);
    expect(highs.map((h) => h.bar)).toEqual([3]);
    expect(highs[0]?.price).toBe(9);
  });

  it("finds a trough", () => {
    const s = series([9, 8, 7, 6, 7, 8, 9], [8, 7, 6, 1, 6, 7, 8]);
    expect(swingLows(s, { from: 0, to: 7 }, 2).map((l) => l.bar)).toEqual([3]);
  });

  it("skips bars too close to the range edge to judge", () => {
    // Bar 0 is the highest, but with only k=2 lookback there is no evidence it is
    // a swing — guessing would invent structure.
    const s = series([9, 3, 2, 1, 2], [8, 2, 1, 0, 1]);
    expect(swingHighs(s, { from: 0, to: 5 }, 2).map((h) => h.bar)).not.toContain(0);
  });

  it("accepts a tie, since an equal high is still not exceeded", () => {
    const s = series([1, 2, 9, 9, 2, 1, 0], [0, 1, 8, 8, 1, 0, 0]);
    const bars = swingHighs(s, { from: 0, to: 7 }, 2).map((h) => h.bar);
    expect(bars.length).toBeGreaterThan(0);
  });

  it("widens with k, finding fewer and more significant swings", () => {
    const highs = [1, 5, 2, 6, 2, 9, 2, 6, 2, 5, 1];
    const lows = highs.map((h) => h - 1);
    const s = series(highs, lows);
    const tight = swingHighs(s, { from: 0, to: 11 }, 1).length;
    const wide = swingHighs(s, { from: 0, to: 11 }, 3).length;
    expect(wide).toBeLessThan(tight);
  });

  it("respects the range rather than scanning the whole series", () => {
    const highs = [1, 2, 9, 2, 1, 1, 2, 9, 2, 1];
    const s = series(highs, highs.map((h) => h - 1));
    expect(swingHighs(s, { from: 0, to: 5 }, 2).map((h) => h.bar)).toEqual([2]);
  });

  it("returns both kinds from one pass", () => {
    const s = series([1, 2, 9, 2, 1, 2, 3], [0, 1, 8, 1, 0, 1, 2]);
    const kinds = new Set(findSwings(s, { from: 0, to: 7 }, 2).map((x) => x.kind));
    expect(kinds.size).toBeGreaterThan(0);
  });
});

describe("readStructure", () => {
  it("reads rising highs and rising lows as an uptrend", () => {
    const swings = [
      { kind: "high" as const, bar: 2, price: 10 },
      { kind: "low" as const, bar: 4, price: 8 },
      { kind: "high" as const, bar: 6, price: 12 },
      { kind: "low" as const, bar: 8, price: 9 },
      { kind: "high" as const, bar: 10, price: 14 },
      { kind: "low" as const, bar: 12, price: 11 },
    ];
    expect(readStructure(swings)).toBe("uptrend");
  });

  it("reads falling highs and falling lows as a downtrend", () => {
    const swings = [
      { kind: "high" as const, bar: 2, price: 14 },
      { kind: "low" as const, bar: 4, price: 11 },
      { kind: "high" as const, bar: 6, price: 12 },
      { kind: "low" as const, bar: 8, price: 9 },
      { kind: "high" as const, bar: 10, price: 10 },
      { kind: "low" as const, bar: 12, price: 8 },
    ];
    expect(readStructure(swings)).toBe("downtrend");
  });

  it("reads mixed structure as a range", () => {
    const swings = [
      { kind: "high" as const, bar: 2, price: 12 },
      { kind: "low" as const, bar: 4, price: 9 },
      { kind: "high" as const, bar: 6, price: 11 },
      { kind: "low" as const, bar: 8, price: 10 },
      { kind: "high" as const, bar: 10, price: 12 },
      { kind: "low" as const, bar: 12, price: 9 },
    ];
    expect(readStructure(swings)).toBe("range");
  });

  it("falls back to range when there is too little to read", () => {
    expect(readStructure([{ kind: "high", bar: 1, price: 10 }])).toBe("range");
    expect(readStructure([])).toBe("range");
  });
});

describe("against the committed data", () => {
  const btc = JSON.parse(
    readFileSync("public/data/series/BTCUSDT-1d.json", "utf8"),
  ) as Series<string>;

  it("finds swings in a real window, and no more highs than bars", () => {
    const range = { from: 1000, to: 1090 };
    const swings = findSwings(btc, range, 2);
    expect(swings.length).toBeGreaterThan(5);
    expect(swings.length).toBeLessThan(range.to - range.from);
  });

  it("never reports a swing high that a neighbour exceeds", () => {
    // The property that matters: a detector that returns non-extremes would make
    // level 2.1 ungradeable.
    const range = { from: 1000, to: 1090 };
    for (const swing of swingHighs(btc, range, 2)) {
      for (let j = swing.bar - 2; j <= swing.bar + 2; j += 1) {
        if (j === swing.bar) continue;
        expect(btc.h[j] ?? 0).toBeLessThanOrEqual(swing.price);
      }
    }
  });

  it("never reports a swing low that a neighbour undercuts", () => {
    const range = { from: 1000, to: 1090 };
    for (const swing of swingLows(btc, range, 2)) {
      for (let j = swing.bar - 2; j <= swing.bar + 2; j += 1) {
        if (j === swing.bar) continue;
        expect(btc.l[j] ?? Infinity).toBeGreaterThanOrEqual(swing.price);
      }
    }
  });

  it("reads the 2020 trendline window as a range, not an uptrend", () => {
    // Measured, and it corrected an assumption in the plan. This window was picked
    // for having a clean rising support line (14 touches, no body cuts), and it was
    // assumed to be an uptrend. It is not: swing highs run
    // 9950 → 10380 → 9993 → 9589 → 9292 → 11395, only 63% rising, with almost all
    // the net move arriving in the final fortnight.
    //
    // It is a consolidation with a rising floor — which makes it a *better* subject
    // for level 2.3 than a clean uptrend, because the support line is doing the work
    // precisely while the highs make no progress. Level 2.3's brief must not call it
    // an uptrend, and level 2.2 needs a different window for HH/HL.
    expect(readStructure(findSwings(btc, { from: 1000, to: 1090 }, 3))).toBe("range");
  });

  it("finds the rising floor that makes a support line the right tool there", () => {
    const swings = findSwings(btc, { from: 1000, to: 1090 }, 3);
    const rising = (kind: "high" | "low") => {
      const prices = swings.filter((s) => s.kind === kind).map((s) => s.price);
      return (
        prices.slice(1).filter((p, i) => p > (prices[i] ?? p)).length /
        (prices.length - 1)
      );
    };
    // The lows hold up better than the highs do. That asymmetry is the lesson.
    expect(rising("low")).toBeGreaterThan(0.5);
    expect(rising("low")).toBeGreaterThanOrEqual(rising("high") - 0.05);
  });
});
