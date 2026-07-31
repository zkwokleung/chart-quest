import { describe, expect, it } from "vitest";
import type { Series } from "./types";
import {
  computeIndicator,
  indicatorLabel,
  indicatorLayoutKey,
  indicatorShape,
  type IndicatorSpec,
} from "./indicator-data";

function ramp(n: number): Series<string> {
  const values = Array.from(
    { length: n },
    (_, i) => 100 + Math.sin(i / 5) * 10,
  );
  return {
    id: "FIXTURE-1d",
    tf: "1d",
    t: values.map((_, i) => Date.UTC(2020, 0, i + 1)),
    o: [...values],
    h: values.map((v) => v + 1),
    l: values.map((v) => v - 1),
    c: [...values],
    v: values.map(() => 1000),
  };
}

const ALL: IndicatorSpec[] = [
  { kind: "sma", period: 20 },
  { kind: "ema", period: 20 },
  { kind: "bollinger", period: 20 },
  { kind: "rsi", period: 14 },
  { kind: "macd" },
];

describe("indicatorShape", () => {
  it("describes an indicator without computing it", () => {
    // The property the chart depends on: series are created with the chart's
    // lifetime, and needing the data to know how many to create would force that
    // effect to re-run on every reveal.
    for (const spec of ALL) {
      const shape = indicatorShape(spec);
      expect(shape.lines.length, indicatorLabel(spec)).toBeGreaterThan(0);
    }
  });

  it("puts price-scale indicators on the price pane and oscillators on their own", () => {
    expect(indicatorShape({ kind: "sma", period: 20 }).overlay).toBe(true);
    expect(indicatorShape({ kind: "ema", period: 20 }).overlay).toBe(true);
    expect(indicatorShape({ kind: "bollinger", period: 20 }).overlay).toBe(
      true,
    );
    // RSI runs 0-100 and MACD oscillates around zero; neither can share a price
    // scale without flattening the candles into a line.
    expect(indicatorShape({ kind: "rsi", period: 14 }).overlay).toBe(false);
    expect(indicatorShape({ kind: "macd" }).overlay).toBe(false);
  });

  it("gives a Bollinger three lines and a MACD two plus a histogram", () => {
    expect(
      indicatorShape({ kind: "bollinger", period: 20 }).lines,
    ).toHaveLength(3);
    const macd = indicatorShape({ kind: "macd" });
    expect(macd.lines).toHaveLength(2);
    expect(macd.histogram).toBe(true);
  });

  it("puts the conventional guides on the oscillators", () => {
    expect(indicatorShape({ kind: "rsi", period: 14 }).guides).toEqual([
      30, 70,
    ]);
    expect(indicatorShape({ kind: "macd" }).guides).toEqual([0]);
    expect(indicatorShape({ kind: "sma", period: 20 }).guides).toEqual([]);
  });

  it("names the period, because 5.1 and 5.2 are about which period", () => {
    // A legend reading "MA" would make those levels unplayable.
    expect(indicatorLabel({ kind: "sma", period: 50 })).toBe("SMA 50");
    expect(indicatorLabel({ kind: "ema", period: 9 })).toBe("EMA 9");
    expect(indicatorLabel({ kind: "rsi", period: 14 })).toBe("RSI 14");
  });
});

describe("computeIndicator", () => {
  it("fills the shape's lines in the same order", () => {
    const series = ramp(120);
    for (const spec of ALL) {
      const shape = indicatorShape(spec);
      const render = computeIndicator(spec, series);
      expect(render.lines.map((l) => l.key)).toEqual(
        shape.lines.map((l) => l.key),
      );
      for (const line of render.lines) {
        expect(line.values, `${indicatorLabel(spec)} ${line.key}`).toHaveLength(
          120,
        );
      }
    }
  });

  it("returns a histogram only for MACD", () => {
    const series = ramp(120);
    expect(computeIndicator({ kind: "macd" }, series).histogram).not.toBe(
      false,
    );
    expect(
      computeIndicator({ kind: "rsi", period: 14 }, series).histogram,
    ).toBe(false);
  });

  it("leaves values null before the indicator is defined", () => {
    // Plotting those as zero would draw a line to the floor for the first `period`
    // bars of every chart.
    const render = computeIndicator({ kind: "sma", period: 20 }, ramp(60));
    expect(render.lines[0]?.values[0]).toBeNull();
    expect(render.lines[0]?.values[18]).toBeNull();
    expect(render.lines[0]?.values[19]).not.toBeNull();
  });

  it("is parallel to the series, so index i is bar i", () => {
    const render = computeIndicator({ kind: "sma", period: 3 }, ramp(30));
    expect(render.lines[0]?.values).toHaveLength(30);
  });
});

describe("indicatorLayoutKey", () => {
  it("ignores parameters, so tuning one does not rebuild the chart", () => {
    // The whole point: a tune-param slider changes the period sixty times a second
    // and must not tear down and recreate every series each frame.
    expect(indicatorLayoutKey([{ kind: "sma", period: 10 }])).toBe(
      indicatorLayoutKey([{ kind: "sma", period: 200 }]),
    );
  });

  it("changes when the set of indicators does", () => {
    expect(indicatorLayoutKey([{ kind: "sma", period: 10 }])).not.toBe(
      indicatorLayoutKey([
        { kind: "sma", period: 10 },
        { kind: "rsi", period: 14 },
      ]),
    );
  });
});
