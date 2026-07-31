import { type Series } from "@/lib/chart/types";

/**
 * Relative strength index, Wilder's smoothing.
 *
 * Wilder rather than a simple mean of gains and losses, because that is what every
 * chart the player will ever look at uses, and a game that teaches "RSI 80" has to
 * mean the same 80 their platform shows. The two diverge by several points on a
 * trending market, which is exactly the situation level 5.3 is built around.
 *
 * The first value at `period` is seeded with a simple mean, as Wilder specified;
 * everything after is smoothed.
 */

/** RSI at every bar, `null` until there is enough history. */
export function rsiSeries(
  series: Series<string>,
  period = 14,
): (number | null)[] {
  const n = series.c.length;
  const out: (number | null)[] = new Array<number | null>(n).fill(null);
  if (period <= 0 || n <= period) return out;

  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i += 1) {
    const change = (series.c[i] ?? 0) - (series.c[i - 1] ?? 0);
    if (change > 0) gain += change;
    else loss -= change;
  }
  gain /= period;
  loss /= period;
  out[period] = toRsi(gain, loss);

  for (let i = period + 1; i < n; i += 1) {
    const change = (series.c[i] ?? 0) - (series.c[i - 1] ?? 0);
    const up = change > 0 ? change : 0;
    const down = change < 0 ? -change : 0;
    gain = (gain * (period - 1) + up) / period;
    loss = (loss * (period - 1) + down) / period;
    out[i] = toRsi(gain, loss);
  }

  return out;
}

export function rsi(
  series: Series<string>,
  index: number,
  period = 14,
): number | null {
  if (index < 0 || index >= series.c.length) return null;
  return rsiSeries(series, period)[index] ?? null;
}

/**
 * 100 when there were no losses in the window.
 *
 * Not a special case to tidy away: an unbroken run of up-bars is precisely the
 * market condition 5.3 teaches about, and returning 100 rather than dividing by
 * zero is the honest reading — relative strength against nothing is total.
 */
function toRsi(gain: number, loss: number): number {
  if (loss === 0) return gain === 0 ? 50 : 100;
  const rs = gain / loss;
  return 100 - 100 / (1 + rs);
}
