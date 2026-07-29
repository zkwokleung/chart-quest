import { describe, expect, it } from "vitest";
import { fixtureSeries } from "./fixture-series";
import { clampRange, toCandlestickData, toVolumeData } from "./to-lwc";
import { barAt, seriesLength, type Series } from "./types";

const tiny: Series = {
  id: "TINY-1d",
  tf: "1d",
  t: [1_000, 2_000, 3_000, 4_000],
  o: [10, 11, 12, 11],
  h: [12, 13, 13, 12],
  l: [9, 10, 11, 10],
  c: [11, 12, 11, 10],
  v: [100, 200, 300, 400],
};

describe("clampRange", () => {
  it("defaults to the whole series", () => {
    expect(clampRange(tiny)).toEqual({ from: 0, to: 4 });
  });

  it("clamps past the end rather than emitting undefined bars", () => {
    expect(clampRange(tiny, { from: 2, to: 99 })).toEqual({ from: 2, to: 4 });
    expect(clampRange(tiny, { from: -5, to: 2 })).toEqual({ from: 0, to: 2 });
  });

  it("collapses an inverted range instead of looping backwards", () => {
    expect(clampRange(tiny, { from: 3, to: 1 })).toEqual({ from: 3, to: 3 });
  });

  it("truncates fractional bounds", () => {
    expect(clampRange(tiny, { from: 0.9, to: 2.9 })).toEqual({ from: 0, to: 2 });
  });
});

describe("toCandlestickData", () => {
  it("is half-open, so `to` is excluded", () => {
    const data = toCandlestickData(tiny, { from: 1, to: 3 });
    expect(data).toHaveLength(2);
    expect(data[0]?.open).toBe(11);
    expect(data[1]?.open).toBe(12);
  });

  it("converts epoch ms to the seconds lightweight-charts expects", () => {
    const [first] = toCandlestickData(tiny, { from: 0, to: 1 });
    expect(first?.time).toBe(1);
  });

  it("preserves OHLC exactly", () => {
    const [bar] = toCandlestickData(tiny, { from: 2, to: 3 });
    expect(bar).toMatchObject({ open: 12, high: 13, low: 11, close: 11 });
  });

  it("handles the full fixture without gaps", () => {
    const data = toCandlestickData(fixtureSeries);
    expect(data).toHaveLength(seriesLength(fixtureSeries));
    expect(data.every((d) => Number.isFinite(d.open))).toBe(true);
  });
});

describe("toVolumeData", () => {
  it("maps volume onto value", () => {
    expect(toVolumeData(tiny, { from: 0, to: 2 })).toEqual([
      { time: 1, value: 100 },
      { time: 2, value: 200 },
    ]);
  });
});

describe("barAt", () => {
  it("returns null outside the series", () => {
    expect(barAt(tiny, -1)).toBeNull();
    expect(barAt(tiny, 4)).toBeNull();
  });

  it("returns null for a non-integer index", () => {
    expect(barAt(tiny, 1.5)).toBeNull();
  });

  it("reads a bar", () => {
    expect(barAt(tiny, 1)).toEqual({ t: 2_000, o: 11, h: 13, l: 10, c: 12, v: 200 });
  });
});

describe("fixtureSeries", () => {
  it("is deterministic across imports", async () => {
    const again = await import("./fixture-series");
    expect(again.fixtureSeries.c).toEqual(fixtureSeries.c);
  });

  it("has parallel arrays of equal length", () => {
    const n = seriesLength(fixtureSeries);
    for (const key of ["o", "h", "l", "c", "v"] as const) {
      expect(fixtureSeries[key]).toHaveLength(n);
    }
  });

  it("has ascending timestamps and coherent highs and lows", () => {
    for (let i = 0; i < seriesLength(fixtureSeries); i += 1) {
      const bar = barAt(fixtureSeries, i);
      expect(bar).not.toBeNull();
      if (!bar) continue;
      expect(bar.h).toBeGreaterThanOrEqual(Math.max(bar.o, bar.c));
      expect(bar.l).toBeLessThanOrEqual(Math.min(bar.o, bar.c));
      if (i > 0) {
        const prev = fixtureSeries.t[i - 1] ?? 0;
        expect(bar.t).toBeGreaterThan(prev);
      }
    }
  });
});
