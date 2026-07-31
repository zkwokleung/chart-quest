import type { BarRange, Series } from "@/lib/chart/types";
import { atr } from "./atr";
import { macdSeries, MACD_DEFAULTS } from "./macd";
import { smaSeries } from "./moving-average";
import { rsiSeries } from "./rsi";

/**
 * Measuring whether two readings of a chart are actually the same reading.
 *
 * Level 6.5 is about over-confluence: a trade justified by a stack of confirmations that
 * turn out to be one fact restated. That claim is checkable rather than rhetorical, which
 * is why this module exists — the reveal shows a correlation matrix computed from the same
 * series the level names, so the player sees the redundancy as numbers.
 *
 * Measured on bars 200–1400 of the three daily assets, and stable across all of them:
 *
 *                  rsi   macd  px/sma20  sma20/50  ret10  range/atr
 *   BTC  rsi        —    0.42    0.907     0.579   0.818     0.128
 *        px/sma20  0.907  0.61     —       0.382   0.926     0.121
 *   SPY  rsi        —    0.54    0.788     0.510   0.688    -0.224
 *   AAPL rsi        —    0.55    0.897     0.609   0.803    -0.046
 *
 * `rsi`, `price-vs-sma20` and `return-10` form a cluster: each one correlates above 0.68
 * with another member on every asset, and above 0.9 on two of them. They are three ways of
 * saying "price has risen recently".
 *
 * `sma20-vs-sma50` and `range-vs-atr` are outside it — the first peaks at 0.609 against
 * any cluster member, the second never passes 0.31 in absolute terms. Different facts.
 *
 * **`macd-histogram` is deliberately not offered as a claim.** It sits in between and it
 * moves: 0.42 against RSI on Bitcoin, 0.80 against the ten-bar return on SPY. Whether it
 * is redundant depends on which market you ask, so building a graded answer on it would
 * make the level a threshold argument rather than a reading. It stays available as a
 * signal for a level that wants to make that exact point.
 */

export type SignalId =
  | "rsi"
  | "macd-histogram"
  | "price-vs-sma20"
  | "sma20-vs-sma50"
  | "return-10"
  | "range-vs-atr";

/**
 * A claim counts as redundant when some *other* claim already says it.
 *
 * The natural reading of "this adds nothing", and the one with a clean margin in the data:
 * every cluster member's strongest partner is at least 0.688 while every outsider's is at
 * most 0.609, so a threshold of 0.75 separates them on all three assets. Averaging a
 * claim's correlations instead would blur that — a claim can duplicate one other reading
 * exactly and be unrelated to the rest, and it is still adding nothing.
 */
export const REDUNDANT_ABOVE = 0.75;

/**
 * A signal as a per-bar number, null where it cannot be computed yet.
 *
 * Everything here is expressed as a *deviation* rather than a level — RSI minus fifty,
 * price as a fraction of its average — so that a correlation is between two things that
 * both sit around zero. Correlating raw RSI against raw price would mostly measure that
 * both drift, which is not the question.
 */
export function signalSeries(
  series: Series<string>,
  id: SignalId,
): (number | null)[] {
  const n = series.c.length;
  const blank = () => new Array<number | null>(n).fill(null);

  switch (id) {
    case "rsi": {
      return rsiSeries(series, 14).map((value) => (value === null ? null : value - 50));
    }
    case "macd-histogram": {
      return macdSeries(series, MACD_DEFAULTS).map((point) =>
        point === null ? null : point.histogram,
      );
    }
    case "price-vs-sma20": {
      const sma = smaSeries(series, 20);
      return sma.map((average, i) =>
        average === null || average === 0 ? null : (series.c[i] ?? 0) / average - 1,
      );
    }
    case "sma20-vs-sma50": {
      const fast = smaSeries(series, 20);
      const slow = smaSeries(series, 50);
      return fast.map((f, i) => {
        const s = slow[i];
        return f === null || s == null || s === 0 ? null : f / s - 1;
      });
    }
    case "return-10": {
      const out = blank();
      for (let i = 10; i < n; i += 1) {
        const then = series.c[i - 10];
        if (then) out[i] = (series.c[i] ?? 0) / then - 1;
      }
      return out;
    }
    case "range-vs-atr": {
      const out = blank();
      for (let i = 0; i < n; i += 1) {
        const volatility = atr(series, i);
        if (volatility > 0) {
          out[i] = ((series.h[i] ?? 0) - (series.l[i] ?? 0)) / volatility;
        }
      }
      return out;
    }
  }
}

/**
 * Pearson correlation over the bars where both series have a value.
 *
 * Returns null rather than NaN when there is nothing to measure — fewer than three shared
 * points, or a series that never varies. A matrix cell that cannot be computed has to be
 * distinguishable from one that computed to zero, because the level shows both.
 */
export function correlation(
  a: readonly (number | null)[],
  b: readonly (number | null)[],
  range?: BarRange,
): number | null {
  const from = Math.max(0, range?.from ?? 0);
  const to = Math.min(a.length, b.length, range?.to ?? Math.min(a.length, b.length));

  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = from; i < to; i += 1) {
    const x = a[i];
    const y = b[i];
    if (x == null || y == null || !Number.isFinite(x) || !Number.isFinite(y)) continue;
    xs.push(x);
    ys.push(y);
  }

  const n = xs.length;
  if (n < 3) return null;

  const meanX = xs.reduce((total, x) => total + x, 0) / n;
  const meanY = ys.reduce((total, y) => total + y, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = xs[i]! - meanX;
    const dy = ys[i]! - meanY;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

export type CorrelationMatrix = {
  signals: SignalId[];
  /** `at(i, j)` is the correlation between `signals[i]` and `signals[j]`, or null. */
  rows: (number | null)[][];
};

export function correlationMatrix(
  series: Series<string>,
  signals: SignalId[],
  range?: BarRange,
): CorrelationMatrix {
  const computed = signals.map((id) => signalSeries(series, id));
  return {
    signals,
    rows: computed.map((a) => computed.map((b) => correlation(a, b, range))),
  };
}

/**
 * The signals that duplicate another signal in the set.
 *
 * What 6.5 asks the player to find, and what its content-claims test recomputes to check
 * the authored answer still matches the data.
 */
export function redundantSignals(
  matrix: CorrelationMatrix,
  threshold = REDUNDANT_ABOVE,
): SignalId[] {
  return matrix.signals.filter((id, i) =>
    matrix.signals.some(
      (_other, j) => i !== j && Math.abs(matrix.rows[i]?.[j] ?? 0) >= threshold,
    ),
  );
}
