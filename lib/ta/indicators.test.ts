import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Series } from "@/lib/chart/types";
import { bollingerSeries } from "./bollinger";
import { macdCrosses, macdSeries } from "./macd";
import { ema, emaSeries, sma, smaSeries } from "./moving-average";
import { rsiSeries } from "./rsi";
import { toAtrUnits, toMode, toPct } from "./normalize";

/**
 * Fixtures are hand-computed, not taken from another implementation.
 *
 * Checking one library against another proves they agree, which is not the same as
 * proving either is right — and every one of these appears on a chart the player
 * will compare against their own platform.
 */
function closes(values: number[]): Series<string> {
  return {
    id: "FIXTURE-1d",
    tf: "1d",
    t: values.map((_, i) => Date.UTC(2020, 0, i + 1)),
    o: values.map((v) => v),
    h: values.map((v) => v + 1),
    l: values.map((v) => v - 1),
    c: [...values],
    v: values.map(() => 1000),
  };
}

describe("sma", () => {
  it("averages the window ending at the index", () => {
    // (2+4+6)/3 = 4
    expect(sma(closes([2, 4, 6, 8]), 2, 3)).toBe(4);
    // (4+6+8)/3 = 6
    expect(sma(closes([2, 4, 6, 8]), 3, 3)).toBe(6);
  });

  it("is null before the window is full, not a partial average", () => {
    // A partial average is a different number wearing the same name, and 5.2
    // compares periods against each other — so a short period must not quietly
    // start earlier with less data than a long one.
    const s = closes([2, 4, 6, 8]);
    expect(sma(s, 0, 3)).toBeNull();
    expect(sma(s, 1, 3)).toBeNull();
    expect(sma(s, 2, 3)).not.toBeNull();
  });

  it("rejects nonsense", () => {
    const s = closes([2, 4, 6]);
    expect(sma(s, 1, 0)).toBeNull();
    expect(sma(s, 1, -3)).toBeNull();
    expect(sma(s, 99, 2)).toBeNull();
  });

  it("smaSeries agrees with sma at every index", () => {
    const s = closes([5, 7, 3, 9, 11, 2, 8, 6]);
    const series = smaSeries(s, 3);
    for (let i = 0; i < s.c.length; i += 1) {
      expect(series[i], `bar ${i}`).toBe(sma(s, i, 3));
    }
  });
});

describe("ema", () => {
  it("seeds with the SMA of the first window", () => {
    // period 3 over [2,4,6,...]: seed = (2+4+6)/3 = 4 at index 2.
    const s = closes([2, 4, 6, 8, 10]);
    expect(ema(s, 2, 3)).toBe(4);
  });

  it("weights the latest close by 2/(period+1)", () => {
    // k = 0.5 at period 3. From seed 4: 8*0.5 + 4*0.5 = 6.
    const s = closes([2, 4, 6, 8, 10]);
    expect(ema(s, 3, 3)).toBeCloseTo(6, 10);
    // then 10*0.5 + 6*0.5 = 8
    expect(ema(s, 4, 3)).toBeCloseTo(8, 10);
  });

  it("does not depend on where the caller started computing", () => {
    // The reason for seeding with an SMA rather than the first close. Two callers
    // asking for the same bar must get the same number.
    const s = closes([9, 3, 7, 1, 8, 4, 6, 2, 5, 10, 3, 8]);
    const viaSeries = emaSeries(s, 4);
    for (let i = 3; i < s.c.length; i += 1) {
      expect(viaSeries[i], `bar ${i}`).toBeCloseTo(
        ema(s, i, 4) ?? Number.NaN,
        10,
      );
    }
  });

  it("is null before the window is full", () => {
    const s = closes([2, 4, 6, 8]);
    expect(ema(s, 1, 3)).toBeNull();
    expect(emaSeries(s, 3)[1]).toBeNull();
  });

  it("lags a step change less than the SMA does, which is 5.1's whole lesson", () => {
    // Flat at 10, then a jump to 20. Two bars later the EMA is closer to the new
    // level than the SMA, because it stopped weighting the old one as heavily.
    const s = closes([10, 10, 10, 10, 10, 20, 20]);
    const emaValue = ema(s, 6, 5) ?? 0;
    const smaValue = sma(s, 6, 5) ?? 0;
    expect(emaValue).toBeGreaterThan(smaValue);
  });
});

describe("rsi", () => {
  it("is 100 when nothing fell in the window", () => {
    const s = closes([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    expect(rsiSeries(s, 14)[14]).toBe(100);
  });

  it("is 0 when nothing rose", () => {
    const s = closes([16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    expect(rsiSeries(s, 14)[14]).toBe(0);
  });

  it("is 50 when gains and losses balance", () => {
    // Alternating +1 / -1 gives equal average gain and loss.
    const values = [10];
    for (let i = 1; i <= 20; i += 1) values.push(i % 2 === 1 ? 11 : 10);
    expect(rsiSeries(closes(values), 14)[14]).toBeCloseTo(50, 6);
  });

  it("is null until there is a full period of changes", () => {
    const s = closes([1, 2, 3, 4, 5]);
    const out = rsiSeries(s, 14);
    expect(out.every((v) => v === null)).toBe(true);
  });

  it("smooths rather than re-averaging, so one spike does not reset it", () => {
    // Wilder's smoothing keeps history. A simple rolling mean would drop the
    // fifteenth-oldest bar entirely; this must not.
    const values = Array.from({ length: 40 }, (_, i) => 100 + i);
    const s = closes(values);
    const out = rsiSeries(s, 14);
    expect(out[20]).toBe(100);
    // One down bar dents it without collapsing it.
    values[21] = values[20]! - 5;
    const dented = rsiSeries(closes(values), 14)[21] ?? 0;
    expect(dented).toBeLessThan(100);
    expect(dented).toBeGreaterThan(60);
  });
});

describe("macd", () => {
  it("is the gap between two EMAs", () => {
    const s = closes(Array.from({ length: 60 }, (_, i) => 100 + i * 2));
    const point = macdSeries(s, { fast: 12, slow: 26, signal: 9 })[50];
    const fast = emaSeries(s, 12)[50] ?? 0;
    const slow = emaSeries(s, 26)[50] ?? 0;
    expect(point?.macd).toBeCloseTo(fast - slow, 10);
  });

  it("keeps histogram = macd − signal", () => {
    const s = closes(
      Array.from({ length: 80 }, (_, i) => 100 + Math.sin(i / 4) * 10),
    );
    for (const point of macdSeries(s)) {
      if (!point) continue;
      expect(point.histogram).toBeCloseTo(point.macd - point.signal, 10);
    }
  });

  it("is null until both EMAs and the signal exist", () => {
    const s = closes(Array.from({ length: 30 }, (_, i) => 100 + i));
    const out = macdSeries(s);
    expect(out[20]).toBeNull();
  });

  it("rejects a fast period at or above the slow one", () => {
    const s = closes(Array.from({ length: 60 }, (_, i) => 100 + i));
    expect(
      macdSeries(s, { fast: 26, slow: 26, signal: 9 }).every((p) => p === null),
    ).toBe(true);
  });

  it("finds a cross exactly where the histogram changes sign", () => {
    const s = closes(
      Array.from({ length: 120 }, (_, i) => 100 + Math.sin(i / 8) * 15),
    );
    const points = macdSeries(s);
    for (const cross of macdCrosses(s)) {
      const before = points[cross.bar - 1]?.histogram ?? 0;
      const after = points[cross.bar]?.histogram ?? 0;
      if (cross.direction === "up") {
        expect(before).toBeLessThanOrEqual(0);
        expect(after).toBeGreaterThan(0);
      } else {
        expect(before).toBeGreaterThanOrEqual(0);
        expect(after).toBeLessThan(0);
      }
    }
  });

  it("finds crosses in an oscillating market", () => {
    const wavy = closes(
      Array.from({ length: 200 }, (_, i) => 100 + Math.sin(i / 6) * 12),
    );
    expect(macdCrosses(wavy).length).toBeGreaterThan(4);
  });

  it("finds none in a straight line, where the histogram is only rounding error", () => {
    // This failed on the first run and the failure was real. On a perfect ramp the
    // MACD line settles at exactly 7 and its signal at 7.000000000000001, giving a
    // histogram of -8.9e-16 — a sign change with no market event behind it. 5.4 asks
    // the player to click every cross, so a cross of that size is unwinnable.
    const straight = closes(Array.from({ length: 200 }, (_, i) => 100 + i));
    expect(macdCrosses(straight)).toHaveLength(0);
  });

  it("still finds a small but genuine cross", () => {
    // The dead zone must not swallow real signals. This one is four orders of
    // magnitude above the rounding floor and has to survive.
    const values = Array.from({ length: 120 }, (_, i) => 100 + i * 0.5);
    for (let i = 80; i < 120; i += 1) values[i] = values[79]! - (i - 79) * 0.5;
    expect(macdCrosses(closes(values)).length).toBeGreaterThan(0);
  });
});

describe("bollinger", () => {
  it("centres on the SMA", () => {
    const s = closes([2, 4, 6, 8, 10, 12]);
    const point = bollingerSeries(s, 3, 2)[4];
    expect(point?.middle).toBe(sma(s, 4, 3));
  });

  it("uses the population standard deviation", () => {
    // Closes 2,4,6 -> mean 4, population sd = sqrt(((2-4)^2+(4-4)^2+(6-4)^2)/3)
    // = sqrt(8/3) = 1.632993...  The sample sd would be 2, a 22% difference.
    const point = bollingerSeries(closes([2, 4, 6]), 3, 1)[2];
    expect((point?.upper ?? 0) - (point?.middle ?? 0)).toBeCloseTo(
      Math.sqrt(8 / 3),
      10,
    );
  });

  it("collapses to the mean when price does not move", () => {
    const point = bollingerSeries(closes([7, 7, 7, 7, 7]), 3, 2)[4];
    expect(point?.upper).toBe(point?.lower);
    expect(point?.upper).toBe(7);
  });

  it("is null before the window is full", () => {
    expect(bollingerSeries(closes([1, 2, 3, 4]), 3)[1]).toBeNull();
  });
});

describe("normalize", () => {
  const s = closes([100, 110, 90, 105]);

  it("expresses percent change from the anchor", () => {
    const pct = toPct(s, 0);
    expect(pct[0]).toBe(0);
    expect(pct[1]).toBeCloseTo(10);
    expect(pct[2]).toBeCloseTo(-10);
  });

  it("expresses ATR-multiples from a single anchor, not a moving denominator", () => {
    // The reason: a per-bar denominator makes the axis non-monotonic, since price
    // can rise while the plotted value falls because volatility grew underneath it.
    const long = closes(Array.from({ length: 40 }, (_, i) => 100 + i));
    const units = toAtrUnits(long, 20, 14);
    for (let i = 21; i < 40; i += 1) {
      expect(units[i] ?? 0, `bar ${i}`).toBeGreaterThan(units[i - 1] ?? 0);
    }
  });

  it("agrees with toMode for a single price", () => {
    expect(toMode(110, "price", s, 0)).toBe(110);
    expect(toMode(110, "pct", s, 0)).toBeCloseTo(10);
  });

  it("returns null rather than a wrong number when there is no anchor", () => {
    expect(toMode(110, "pct", s, 99)).toBeNull();
    expect(toPct(s, 99).every((v) => v === null)).toBe(true);
  });

  it("makes Bitcoin and SPY comparable, which is 5.5's whole claim", () => {
    // Measured against the committed spine rather than asserted: the same 3% day is
    // ordinary for one market and extreme for the other.
    const load = (id: string) =>
      JSON.parse(
        readFileSync(`public/data/series/${id}.json`, "utf8"),
      ) as Series<string>;
    const share = (id: string) => {
      const series = load(id);
      const values: number[] = [];
      for (let i = 20; i < series.t.length; i += 1) {
        const a = atrShare(series, i);
        if (a > 0) values.push(a);
      }
      return values.filter((v) => v > 3).length / values.length;
    };
    expect(share("BTCUSDT-1d")).toBeGreaterThan(0.8);
    expect(share("SPY-1d")).toBeLessThan(0.1);
  });
});

function atrShare(series: Series<string>, index: number): number {
  const period = 14;
  if (index - period + 1 < 0) return 0;
  let total = 0;
  for (let k = index - period + 1; k <= index; k += 1) {
    const prev = series.c[k - 1] ?? series.c[k] ?? 0;
    total += Math.max(
      (series.h[k] ?? 0) - (series.l[k] ?? 0),
      Math.abs((series.h[k] ?? 0) - prev),
      Math.abs((series.l[k] ?? 0) - prev),
    );
  }
  return (total / period / (series.c[index] ?? 1)) * 100;
}
