import { describe, expect, it } from "vitest";
import {
  buildSeries,
  indexAtOrAfter,
  sliceSeries,
  trimAfter,
  validateSeries,
  type RawBar,
} from "./columnar.ts";

const DAY = 86_400_000;
const T0 = Date.UTC(2024, 0, 1);

function bar(i: number, over: Partial<RawBar> = {}): RawBar {
  return { t: T0 + i * DAY, o: 100, h: 101, l: 99, c: 100.5, v: 1000, ...over };
}

describe("buildSeries", () => {
  it("drops bars with null prices", () => {
    const { series, dropped } = buildSeries(
      "X-1d",
      "1d",
      [bar(0), bar(1, { c: null }), bar(2)],
      2,
    );
    expect(series.t).toHaveLength(2);
    expect(dropped).toBe(1);
  });

  it("drops non-increasing timestamps", () => {
    const { series, dropped } = buildSeries(
      "X-1d",
      "1d",
      [bar(0), bar(0), bar(1)],
      2,
    );
    expect(series.t).toHaveLength(2);
    expect(dropped).toBe(1);
  });

  it("widens a high that sits below the close", () => {
    // Yahoo does this on roughly 5% of gold bars: the extremes and the endpoints
    // come from different feeds, so the range can exclude its own close.
    const { series, repaired } = buildSeries(
      "X-1d",
      "1d",
      [bar(0, { h: 100, c: 100.5 })],
      2,
    );
    expect(repaired).toBe(1);
    expect(series.h[0]).toBe(100.5);
  });

  it("widens a low that sits above the open", () => {
    const { series, repaired } = buildSeries(
      "X-1d",
      "1d",
      [bar(0, { o: 98, l: 99 })],
      2,
    );
    expect(repaired).toBe(1);
    expect(series.l[0]).toBe(98);
  });

  it("does not count a consistent bar as repaired", () => {
    expect(buildSeries("X-1d", "1d", [bar(0)], 2).repaired).toBe(0);
  });

  it("rounds to the requested precision", () => {
    const { series } = buildSeries(
      "X-1d",
      "1d",
      [bar(0, { o: 1.123456, h: 1.2, l: 1.0, c: 1.111111 })],
      5,
    );
    expect(series.o[0]).toBe(1.12346);
    expect(series.c[0]).toBe(1.11111);
  });

  it("rounds extremes outward so rounding cannot break a bar", () => {
    // Rounding h down or l up independently could push the range inside the
    // endpoints; clamping after rounding prevents that.
    const { series } = buildSeries(
      "X-1d",
      "1d",
      [bar(0, { o: 1.005, h: 1.0049, l: 0.9, c: 1.0 })],
      2,
    );
    const h = series.h[0] ?? 0;
    const o = series.o[0] ?? 0;
    expect(h).toBeGreaterThanOrEqual(o);
  });

  it("treats null volume as zero", () => {
    const { series } = buildSeries("X-1d", "1d", [bar(0, { v: null })], 2);
    expect(series.v[0]).toBe(0);
  });
});

describe("validateSeries", () => {
  const good = buildSeries(
    "X-1d",
    "1d",
    Array.from({ length: 10 }, (_, i) => bar(i)),
    2,
  ).series;

  it("accepts a clean series", () => {
    expect(() => validateSeries(good, { minBars: 5, precision: 2 })).not.toThrow();
  });

  it("rejects a series that is suspiciously short", () => {
    expect(() => validateSeries(good, { minBars: 50, precision: 2 })).toThrow(
      /only 10 bars/,
    );
  });

  it("rejects a non-positive price", () => {
    const broken = { ...good, c: [...good.c] };
    broken.c[3] = 0;
    expect(() => validateSeries(broken, { minBars: 5, precision: 2 })).toThrow(
      /non-positive/,
    );
  });

  it("rejects a range that excludes its endpoints", () => {
    const broken = { ...good, h: [...good.h] };
    broken.h[2] = 1;
    expect(() => validateSeries(broken, { minBars: 5, precision: 2 })).toThrow(
      /high 1 is below/,
    );
  });

  it("rejects mismatched column lengths", () => {
    const broken = { ...good, v: good.v.slice(0, 5) };
    expect(() => validateSeries(broken, { minBars: 5, precision: 2 })).toThrow(
      /column v has 5/,
    );
  });

  it("rejects a precision so coarse the bars collapse", () => {
    // The FX rounding risk: at too few decimals every high equals its low.
    const flat = buildSeries(
      "FX-1d",
      "1d",
      Array.from({ length: 10 }, (_, i) =>
        bar(i, { o: 1.1, h: 1.10004, l: 1.09996, c: 1.1 }),
      ),
      2,
    ).series;
    expect(() => validateSeries(flat, { minBars: 5, precision: 2 })).toThrow(
      /too coarse/,
    );
  });
});

describe("trimAfter", () => {
  const s = buildSeries("X-1d", "1d", [bar(0), bar(1), bar(2)], 2).series;

  it("drops trailing bars past the cutoff", () => {
    const { series, trimmed } = trimAfter(s, T0 + DAY);
    expect(trimmed).toBe(1);
    expect(series.t).toHaveLength(2);
  });

  it("keeps a bar exactly on the cutoff", () => {
    expect(trimAfter(s, T0 + 2 * DAY).trimmed).toBe(0);
  });

  it("is a no-op when nothing is past the cutoff", () => {
    const { series, trimmed } = trimAfter(s, T0 + 99 * DAY);
    expect(trimmed).toBe(0);
    expect(series).toBe(s);
  });
});

describe("sliceSeries and indexAtOrAfter", () => {
  const s = buildSeries(
    "X-1d",
    "1d",
    Array.from({ length: 5 }, (_, i) => bar(i)),
    2,
  ).series;

  it("slices every column", () => {
    const out = sliceSeries(s, 1, 3);
    expect(out.t).toHaveLength(2);
    expect(out.v).toHaveLength(2);
    expect(out.t[0]).toBe(T0 + DAY);
  });

  it("finds the first bar at or after a timestamp", () => {
    expect(indexAtOrAfter(s, T0 + 2 * DAY)).toBe(2);
    expect(indexAtOrAfter(s, T0 + 2 * DAY - 1)).toBe(2);
    expect(indexAtOrAfter(s, T0 + 99 * DAY)).toBe(5);
  });
});
