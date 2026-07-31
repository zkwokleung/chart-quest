import { type Series } from "@/lib/chart/types";
import { smaSeries } from "./moving-average";

/**
 * Bollinger bands: a moving average with a standard-deviation envelope.
 *
 * The population standard deviation, not the sample one — dividing by `period`
 * rather than `period - 1`. Both appear in the wild and they differ by about 2% at
 * period 20, which is enough to move a band visibly. Every charting platform the
 * player will compare against uses the population form, and matching what they see
 * matters more here than statistical fastidiousness about an estimator whose
 * "sample" is a deliberately chosen window rather than a draw from anything.
 */

export type BollingerPoint = {
  middle: number;
  upper: number;
  lower: number;
};

export function bollingerSeries(
  series: Series<string>,
  period = 20,
  deviations = 2,
): (BollingerPoint | null)[] {
  const n = series.c.length;
  const out: (BollingerPoint | null)[] = new Array<BollingerPoint | null>(
    n,
  ).fill(null);
  if (period <= 0 || n < period) return out;

  const middle = smaSeries(series, period);

  for (let i = period - 1; i < n; i += 1) {
    const mean = middle[i];
    if (mean === null || mean === undefined) continue;

    let variance = 0;
    for (let k = i - period + 1; k <= i; k += 1) {
      const diff = (series.c[k] ?? mean) - mean;
      variance += diff * diff;
    }
    const sd = Math.sqrt(variance / period);

    out[i] = {
      middle: mean,
      upper: mean + sd * deviations,
      lower: mean - sd * deviations,
    };
  }

  return out;
}
