import { type Series } from "@/lib/chart/types";

/**
 * Simple and exponential moving averages.
 *
 * Both return `null` for an index whose window runs off the front of the series
 * rather than averaging whatever happens to be there. A partial average is not a
 * shorter moving average, it is a different number wearing the same name, and a
 * level asking "which period did this market respect" would be comparing periods
 * that had each quietly been given a different amount of data.
 */

/** Mean close over the `period` bars ending at `index`. */
export function sma(
  series: Series<string>,
  index: number,
  period: number,
): number | null {
  if (period <= 0 || index < 0 || index >= series.c.length) return null;
  const first = index - period + 1;
  if (first < 0) return null;

  let total = 0;
  for (let i = first; i <= index; i += 1) {
    const close = series.c[i];
    if (close === undefined) return null;
    total += close;
  }
  return total / period;
}

/**
 * Exponentially weighted mean close, seeded with the SMA of the first window.
 *
 * Seeding matters and is the commonest source of disagreement between two EMA
 * implementations: starting from the first close alone leaves a visible transient
 * that takes several periods to decay, so an early bar's value depends on how far
 * back the caller happened to start. Seeding with the SMA is the convention every
 * charting package uses, and it makes the value at `index` depend only on the
 * series, not on where the computation began.
 */
export function ema(
  series: Series<string>,
  index: number,
  period: number,
): number | null {
  if (period <= 0 || index < 0 || index >= series.c.length) return null;
  const first = index - period + 1;
  if (first < 0) return null;

  const seed = sma(series, period - 1, period);
  if (seed === null) return null;

  const k = 2 / (period + 1);
  let value = seed;
  for (let i = period; i <= index; i += 1) {
    const close = series.c[i];
    if (close === undefined) return null;
    value = close * k + value * (1 - k);
  }
  return value;
}

/**
 * A whole series of one of the above, `null` where it is not yet defined.
 *
 * The chart needs every bar at once, and computing `ema` per bar would be O(n²)
 * over the window because each call re-walks from the seed.
 */
export function smaSeries(
  series: Series<string>,
  period: number,
): (number | null)[] {
  const out: (number | null)[] = [];
  let total = 0;
  for (let i = 0; i < series.c.length; i += 1) {
    total += series.c[i] ?? 0;
    if (i >= period) total -= series.c[i - period] ?? 0;
    out.push(i >= period - 1 && period > 0 ? total / period : null);
  }
  return out;
}

export function emaSeries(
  series: Series<string>,
  period: number,
): (number | null)[] {
  const out: (number | null)[] = new Array<number | null>(series.c.length).fill(
    null,
  );
  if (period <= 0 || series.c.length < period) return out;

  const seed = sma(series, period - 1, period);
  if (seed === null) return out;

  const k = 2 / (period + 1);
  let value = seed;
  out[period - 1] = value;
  for (let i = period; i < series.c.length; i += 1) {
    value = (series.c[i] ?? value) * k + value * (1 - k);
    out[i] = value;
  }
  return out;
}
