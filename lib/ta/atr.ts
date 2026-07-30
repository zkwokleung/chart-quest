import { barAt, type Series } from "@/lib/chart/types";

/**
 * Average true range.
 *
 * Lands in M5 rather than with the rest of the indicators in M6 because stop
 * grading needs a volatility yardstick and cannot be written without one: "half an
 * ATR of room below the swing low" is the judgement Chapter 3 is teaching, and a
 * stop measured in dollars means nothing across six markets. M6 owns the indicator
 * panel and the ATR y-axis mode; this is only the primitive underneath them.
 */

/**
 * True range at one bar.
 *
 * The previous close is part of the definition — a market that gapped has moved
 * further than its own high minus low admits, which is exactly the case Chapter 1
 * teaches about and Chapter 3 has to price. The first bar of a series has no
 * previous close, so it falls back to high minus low.
 */
export function trueRange(series: Series<string>, index: number): number {
  const bar = barAt(series, index);
  if (!bar) return 0;
  const previous = barAt(series, index - 1);
  if (!previous) return bar.h - bar.l;
  return Math.max(
    bar.h - bar.l,
    Math.abs(bar.h - previous.c),
    Math.abs(bar.l - previous.c),
  );
}

/**
 * Mean true range over the `period` bars ending at `index`.
 *
 * A simple mean rather than Wilder's smoothing: it is what the content searches
 * measured with, so the numbers in the level files and the numbers the grader
 * computes are the same numbers. Returns 0 when the window runs off the front of
 * the series, which callers treat as "no volatility estimate" rather than "zero
 * volatility" — a stop grader must not divide by it blindly.
 */
export function atr(
  series: Series<string>,
  index: number,
  period = 14,
): number {
  if (period <= 0) return 0;
  const first = index - period + 1;
  if (first < 0 || index >= series.t.length) return 0;

  let total = 0;
  for (let i = first; i <= index; i += 1) total += trueRange(series, i);
  return total / period;
}

/**
 * ATR as a fraction of price.
 *
 * The cross-asset comparator: 3% a day is ordinary for Bitcoin and a crisis for
 * SPY. Chapter 5 makes this the lesson; here it is what lets one set of stop
 * tolerances work on every series in the spine.
 */
export function atrFraction(
  series: Series<string>,
  index: number,
  period = 14,
): number {
  const close = barAt(series, index)?.c;
  if (!close) return 0;
  const value = atr(series, index, period);
  return value / close;
}
