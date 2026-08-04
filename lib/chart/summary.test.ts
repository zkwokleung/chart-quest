import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { atr } from "@/lib/ta/atr";
import { sampleIndices, summarise, summaryLine, SAMPLE_ROWS } from "./summary";
import type { Series, SeriesId } from "./types";

/**
 * What a reader who cannot see the chart is told.
 *
 * The assertions that matter are about restraint: that the sample stays small enough to listen to, and
 * that a figure is never invented where the data cannot support one. The arithmetic is `atr`'s and has
 * its own suite.
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

/** A synthetic series so a window's figures can be stated rather than found. */
function flat(bars: number, close = 100): Series<string> {
  return {
    id: "test",
    tf: "1d",
    t: Array.from({ length: bars }, (_, i) => Date.UTC(2020, 0, 1) + i * 864e5),
    o: Array.from({ length: bars }, () => close),
    h: Array.from({ length: bars }, () => close + 1),
    l: Array.from({ length: bars }, () => close - 1),
    c: Array.from({ length: bars }, () => close),
    v: Array.from({ length: bars }, () => 1),
  };
}

describe("the sample stays listenable", () => {
  it("never returns more rows than a reader can hold", () => {
    const spy = load("SPY-1d");
    const summary = summarise(spy, { from: 210, to: 4_612 })!;
    // 4,402 bars in; twenty out. The whole point of the module.
    expect(summary.bars).toBe(4_402);
    expect(summary.rows.length).toBeLessThanOrEqual(SAMPLE_ROWS);
  });

  it("returns every bar when there are fewer than the sample size", () => {
    expect(sampleIndices(0, 5)).toEqual([0, 1, 2, 3, 4]);
    expect(summarise(flat(5), { from: 0, to: 5 })!.rows).toHaveLength(5);
  });

  it("always includes the first and last bar of the window", () => {
    const picked = sampleIndices(100, 1_000);
    expect(picked[0]).toBe(100);
    expect(picked.at(-1)).toBe(999);
  });

  it("spaces the rest evenly rather than choosing interesting bars", () => {
    // Even spacing is a refusal to decide what matters — that is the level's question, not this
    // module's, and picking "notable" bars would leak an opinion about the answer.
    const picked = sampleIndices(0, 200, 5);
    expect(picked).toEqual([0, 50, 100, 149, 199]);
  });

  it("emits no repeated row when rounding collides at the ends", () => {
    const picked = sampleIndices(0, 21, 20);
    expect(new Set(picked).size).toBe(picked.length);
  });

  it("returns nothing for an empty or inverted window rather than throwing", () => {
    expect(sampleIndices(10, 10)).toEqual([]);
    expect(summarise(flat(10), { from: 5, to: 5 })).toBeNull();
    expect(summarise(flat(10), { from: 8, to: 2 })).toBeNull();
  });

  it("clamps a window that runs past the end of the series", () => {
    const summary = summarise(flat(10), { from: 0, to: 999 })!;
    expect(summary.bars).toBe(10);
    expect(summary.rows.at(-1)!.bar).toBe(9);
  });
});

describe("the figures", () => {
  it("reports the window's own high and low, not the series'", () => {
    const spy = load("SPY-1d");
    const window = { from: 3_228, to: 3_478 };
    const summary = summarise(spy, window)!;
    const highs = spy.h.slice(window.from, window.to);
    const lows = spy.l.slice(window.from, window.to);
    expect(summary.high).toBeCloseTo(Math.max(...highs), 6);
    expect(summary.low).toBeCloseTo(Math.min(...lows), 6);
    // And they are genuinely narrower than the whole series', or the test proves nothing.
    expect(summary.high).toBeLessThan(Math.max(...spy.h));
  });

  it("reports the move in ATR as well as percent, because percent does not travel", () => {
    // Chapter 8's comparator: 3% is an ordinary day for Bitcoin and a crisis for the index.
    const spy = load("SPY-1d");
    const window = { from: 3_228, to: 3_478 };
    const summary = summarise(spy, window)!;
    const volatility = atr(spy, window.to - 1, 14);
    const expected = (spy.c[window.to - 1]! - spy.c[window.from]!) / volatility;
    expect(summary.changeAtr).toBeCloseTo(expected, 6);
  });

  it("says nothing rather than zero when ATR cannot be computed", () => {
    // "No reading" and "no movement" are different facts, and a window shorter than the lookback has
    // the first rather than the second.
    const summary = summarise(flat(5), { from: 0, to: 5 })!;
    expect(summary.changeAtr).toBeNull();
  });

  it("reports a flat window as flat rather than as missing", () => {
    const summary = summarise(flat(60), { from: 0, to: 60 })!;
    expect(summary.changePct).toBe(0);
    expect(summary.changeAtr).toBe(0);
  });

  it("names the series and its timeframe, which the chart's label already does", () => {
    const summary = summarise(load("BTCUSDT-4h"), { from: 100, to: 400 })!;
    expect(summary.seriesId).toBe("BTCUSDT-4h");
    expect(summary.timeframe).toBe("4h");
  });
});

describe("the one-line form", () => {
  it("leads with what a glance at the chart would give", () => {
    const line = summaryLine(summarise(load("SPY-1d"), { from: 3_228, to: 3_478 })!);
    expect(line).toContain("SPY-1d");
    expect(line).toContain("250 bars");
    expect(line).toMatch(/from \d{4}-\d{2}-\d{2} to \d{4}-\d{2}-\d{2}/);
    expect(line).toMatch(/Net (up|down) \d+\.\d%/);
    expect(line).toContain("times an ordinary day's range");
  });

  it("omits the ATR clause rather than printing a null", () => {
    const line = summaryLine(summarise(flat(5), { from: 0, to: 5 })!);
    expect(line).not.toContain("ordinary day");
    expect(line).not.toContain("null");
    expect(line).toContain("Net up 0.0%");
  });
});

describe("what it deliberately cannot do", () => {
  it("takes no level, so no summary can leak a level's answer", () => {
    // **The structural guarantee.** The obvious next feature is "show the bars the level is about",
    // and `Mark` is `bar:${number}` — a target-derived table is the answer key in text, handed to a
    // `mark-bars` player while a sighted one hunts for it. `summarise` has no access to a level.
    expect(summarise.length).toBeLessThanOrEqual(3);
    // Asserted over the *imports* rather than the source text: the module's own doc explains at length
    // why it must not touch a target, so a raw search for the word finds the warning against it.
    const imports = readFileSync("lib/chart/summary.ts", "utf8")
      .split("\n")
      .filter((line) => line.startsWith("import"))
      .join(" ");
    expect(imports).not.toContain("lib/levels");
    expect(imports).toEqual(expect.stringContaining("lib/ta/atr"));
  });
});
