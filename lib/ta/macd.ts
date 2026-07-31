import { type Series } from "@/lib/chart/types";
import { emaSeries } from "./moving-average";

/**
 * MACD: the distance between two EMAs, and an EMA of that distance.
 *
 * Level 5.4's whole point is in the name — it is two moving averages and nothing
 * more, so a "MACD cross" is just the faster average overtaking the slower one.
 * Presenting it as a distinct oracle is the misconception the level exists to
 * correct, which is why this module is thirty lines rather than a black box.
 */

export type MacdPoint = {
  /** fast EMA − slow EMA */
  macd: number;
  /** EMA of `macd` over `signalPeriod` */
  signal: number;
  /** macd − signal. Crosses zero exactly when the two lines cross. */
  histogram: number;
};

export type MacdParams = {
  fast: number;
  slow: number;
  signal: number;
};

export const MACD_DEFAULTS: MacdParams = { fast: 12, slow: 26, signal: 9 };

export function macdSeries(
  series: Series<string>,
  params: MacdParams = MACD_DEFAULTS,
): (MacdPoint | null)[] {
  const { fast, slow, signal } = params;
  const n = series.c.length;
  const out: (MacdPoint | null)[] = new Array<MacdPoint | null>(n).fill(null);
  if (fast <= 0 || slow <= 0 || signal <= 0 || fast >= slow) return out;

  const fastLine = emaSeries(series, fast);
  const slowLine = emaSeries(series, slow);

  // The MACD line only exists where both EMAs do, and the signal is an EMA *of
  // that line* — so it is seeded from the first `signal` defined MACD values
  // rather than from bar zero, which would smuggle in the undefined stretch.
  const macd: (number | null)[] = fastLine.map((f, i) => {
    const s = slowLine[i];
    return f === null || s === undefined || s === null ? null : f - s;
  });

  const firstDefined = macd.findIndex((v) => v !== null);
  if (firstDefined < 0 || firstDefined + signal > n) return out;

  let seed = 0;
  for (let i = firstDefined; i < firstDefined + signal; i += 1)
    seed += macd[i] ?? 0;
  seed /= signal;

  const k = 2 / (signal + 1);
  let signalValue = seed;
  for (let i = firstDefined + signal - 1; i < n; i += 1) {
    const line = macd[i];
    if (line === null || line === undefined) continue;
    if (i > firstDefined + signal - 1) {
      signalValue = line * k + signalValue * (1 - k);
    }
    out[i] = { macd: line, signal: signalValue, histogram: line - signalValue };
  }

  return out;
}

/**
 * Bars where the MACD line crossed its signal.
 *
 * Returned with a direction because 5.4 asks the player to find them and then
 * count how many went nowhere — the crossings are trivially detectable, and the
 * lesson is entirely in what happened afterwards.
 */
export function macdCrosses(
  series: Series<string>,
  params: MacdParams = MACD_DEFAULTS,
): { bar: number; direction: "up" | "down" }[] {
  const points = macdSeries(series, params);
  const out: { bar: number; direction: "up" | "down" }[] = [];

  for (let i = 1; i < points.length; i += 1) {
    const previous = points[i - 1];
    const current = points[i];
    if (!previous || !current) continue;

    // A histogram within rounding error of zero counts as zero. On a market that
    // barely moves the two EMAs sit on top of each other and the difference is
    // floating-point residue — a perfectly straight line produced a "cross" at
    // -8.9e-16. 5.4 asks the player to click every cross, so a cross nobody can see
    // is a level nobody can win.
    const before = deadZero(previous.histogram, previous.macd);
    const after = deadZero(current.histogram, current.macd);

    if (before <= 0 && after > 0) {
      out.push({ bar: i, direction: "up" });
    } else if (before >= 0 && after < 0) {
      out.push({ bar: i, direction: "down" });
    }
  }

  return out;
}

/** Zero, for a histogram indistinguishable from it at the MACD line's own scale. */
function deadZero(histogram: number, macd: number): number {
  const epsilon = Math.max(Math.abs(macd), 1e-12) * 1e-9;
  return Math.abs(histogram) < epsilon ? 0 : histogram;
}
