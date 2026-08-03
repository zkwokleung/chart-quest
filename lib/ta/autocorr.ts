import type { Series } from "@/lib/chart/types";

/**
 * Whether a market's moves continue or reverse, measured rather than asserted.
 *
 * Chapter 8 exists because every earlier chapter applied cross-asset pressure without ever
 * teaching *why* assets differ. This module is where "why" stops being a claim: the player
 * drives the horizon and reads the number, which is what issue #26 requires of level 8.2.
 *
 * ## The measurement, and the four choices inside it
 *
 * A variance ratio compares the variance of a q-period return against q times the variance of
 * a one-period return. Under a random walk the two are equal and VR = 1. Above 1 the moves
 * reinforce each other; below 1 they cancel.
 *
 * **Log returns, not simple ones.** VR is the variance of a *sum* of one-period returns over
 * the variance of one of them, and only log returns sum. With simple returns VR(q) is not the
 * ratio it claims to be, and the error grows with volatility — largest on Bitcoin, which is
 * the asset 8.2 is about.
 *
 * **Overlapping windows with the Lo–MacKinlay finite-sample correction**, not
 * non-overlapping. At q = 60 over the ~1,434 equity bars in Chapter 8's window,
 * non-overlapping leaves 23 observations and the statistic is noise wearing three decimals.
 *
 * **The heteroskedasticity-robust z, not the homoskedastic one.** Returns are conditionally
 * heteroskedastic — volatility clusters — and the homoskedastic statistic would report
 * Bitcoin's VR(60) of 1.31 as overwhelming when it may not be. This is `base-rates.ts`'s
 * discipline applied to a different statistic: the interval *is* the lesson, and a level that
 * ranks assets by a number has to know which gaps are real.
 *
 * **Nulls are dropped, never imputed.** A gap in the returns breaks the q-period sum rather
 * than bridging it, because a sum across a hole is a return over a period that did not happen.
 *
 * ## Which bars to use
 *
 * A variance ratio is **within-asset**: it must run over that asset's own consecutive bars,
 * including Bitcoin's weekends. Dropping them to match the equities' calendar would change
 * what "a one-day return" means for Bitcoin and measure something else. Correlation is the
 * opposite case and lives in `cross-asset.ts`, which aligns on dates for exactly the reason
 * this module must not.
 */

/** The smallest sample worth reporting a statistic from. */
const MIN_OBSERVATIONS = 30;

export type BarRange = { from: number; to: number };

/**
 * Bar-to-bar log returns, `null` wherever one cannot be formed.
 *
 * Null rather than skipped, so the caller can see where the holes are and decide. A
 * non-positive close is a data defect rather than a price, and `Math.log` of it would poison
 * every window it touched.
 */
export function logReturns(
  series: Series<string>,
  range?: BarRange,
): (number | null)[] {
  const from = Math.max(1, range?.from ?? 1);
  const to = Math.min(series.c.length - 1, range?.to ?? series.c.length - 1);

  const out: (number | null)[] = [];
  for (let i = from; i <= to; i += 1) {
    const previous = series.c[i - 1];
    const current = series.c[i];
    out.push(
      previous === undefined ||
        current === undefined ||
        previous <= 0 ||
        current <= 0
        ? null
        : Math.log(current / previous),
    );
  }
  return out;
}

/** Drops the holes. Used wherever a statistic needs a contiguous sample. */
export function compact(xs: readonly (number | null)[]): number[] {
  return xs.filter((x): x is number => x !== null && Number.isFinite(x));
}

function mean(xs: readonly number[]): number {
  return xs.reduce((total, x) => total + x, 0) / xs.length;
}

/**
 * Autocorrelation of a return series at one lag.
 *
 * Reported alongside the variance ratio because the two are tied — `vr(2) - 1` approximates
 * `rho(1)` — and a test asserts they agree on every committed series. That identity is the
 * cheapest available check that the estimator is not subtly wrong, which no hand-built
 * fixture would catch.
 */
export function autocorrelation(
  xs: readonly (number | null)[],
  lag: number,
): number | null {
  const x = compact(xs);
  if (lag < 1 || x.length < MIN_OBSERVATIONS + lag) return null;

  const m = mean(x);
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < x.length; i += 1) denominator += (x[i]! - m) ** 2;
  for (let i = lag; i < x.length; i += 1) {
    numerator += (x[i]! - m) * (x[i - lag]! - m);
  }
  return denominator === 0 ? null : numerator / denominator;
}

/** ±1.96/√n. An autocorrelation inside this band is not distinguishable from zero. */
export function noiseBand(n: number): number {
  return n <= 0 ? Infinity : 1.959964 / Math.sqrt(n);
}

export type VarianceRatio = {
  /** Aggregation horizon, in bars. */
  q: number;
  /** var(q-period return) / q ÷ var(1-period return). 1.0 is a random walk. */
  vr: number;
  /**
   * Lo–MacKinlay heteroskedasticity-robust z, testing VR = 1.
   *
   * Under 2 in absolute value means the market is not distinguishable from a random walk at
   * this horizon — which is the honest reading for four of the six committed assets, and the
   * reason 8.3's tolerance is derived from these rather than chosen.
   */
  z: number;
  /** One-period returns behind the estimate. */
  n: number;
};

/**
 * The variance ratio at one horizon, or null when the sample cannot support it.
 *
 * `q = 1` returns exactly 1 with `z = 0` by construction rather than by arithmetic: the
 * statistic compares a one-period variance against itself, and letting floating point decide
 * would leave a level's reference answer depending on rounding.
 */
export function varianceRatio(
  xs: readonly number[],
  q: number,
): VarianceRatio | null {
  const n = xs.length;
  if (!Number.isInteger(q) || q < 1) return null;
  if (n < MIN_OBSERVATIONS || n < q + 1) return null;
  if (q === 1) return { q, vr: 1, z: 0, n };

  const m = mean(xs);

  let variance1 = 0;
  for (const x of xs) variance1 += (x - m) ** 2;
  variance1 /= n - 1;
  if (variance1 === 0) return null;

  // Overlapping q-period sums, with Lo-MacKinlay's unbiasing denominator. Non-overlapping
  // would leave n/q observations, which at q=60 is two dozen.
  let varianceQ = 0;
  for (let i = 0; i + q <= n; i += 1) {
    let sum = 0;
    for (let j = 0; j < q; j += 1) sum += xs[i + j]!;
    varianceQ += (sum - q * m) ** 2;
  }
  const unbiasing = q * (n - q + 1) * (1 - q / n);
  if (unbiasing <= 0) return null;
  varianceQ /= unbiasing;

  const vr = varianceQ / variance1;

  // Robust variance: a weighted sum of the individual autocovariance variances, which is what
  // makes the statistic survive volatility clustering.
  const deviations = xs.map((x) => x - m);
  let theta = 0;
  for (let j = 1; j < q; j += 1) {
    let delta = 0;
    for (let i = j; i < n; i += 1) {
      delta += deviations[i]! ** 2 * deviations[i - j]! ** 2;
    }
    delta /= (variance1 * (n - 1)) ** 2;
    const weight = 2 * (1 - j / q);
    theta += weight * weight * delta;
  }

  return {
    q,
    vr,
    z: theta > 0 ? (vr - 1) / Math.sqrt(theta) : 0,
    n,
  };
}

export function varianceRatioCurve(
  xs: readonly number[],
  qs: readonly number[],
): VarianceRatio[] {
  return qs
    .map((q) => varianceRatio(xs, q))
    .filter((point): point is VarianceRatio => point !== null);
}

/**
 * The horizon at which a curve first crosses `level`, interpolated between grid points.
 *
 * 8.2's whole subject: Bitcoin sits below 1 at a one-day horizon and above it at twenty, so
 * "crypto trends" is true only above the crossing. Interpolated rather than snapped to the
 * grid because the crossing is a property of the market, not of the horizons someone chose to
 * compute.
 */
export function crossingHorizon(
  curve: readonly VarianceRatio[],
  level = 1,
): number | null {
  const points = [...curve].sort((a, b) => a.q - b.q);
  for (let i = 1; i < points.length; i += 1) {
    const previous = points[i - 1]!;
    const current = points[i]!;
    if (previous.vr < level && current.vr >= level) {
      const span = current.vr - previous.vr;
      const fraction = span === 0 ? 0 : (level - previous.vr) / span;
      return previous.q + fraction * (current.q - previous.q);
    }
  }
  return null;
}
