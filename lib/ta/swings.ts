import { barAt, type Series } from "@/lib/chart/types";
import type { BarRange } from "@/lib/chart/types";

/**
 * Fractal swing detection.
 *
 * A swing high is a bar whose high is at least as high as every bar within `k`
 * either side; a swing low is the mirror. This is the simplest definition that
 * matches what a reader sees, and it is what Chapter 2 teaches — so the game and
 * the player use the same rule.
 *
 * Lives in `lib/ta/` per docs/ARCHITECTURE.md; the indicators arrive around it in
 * a later milestone.
 */

export type SwingKind = "high" | "low";

export type Swing = {
  kind: SwingKind;
  /** Absolute bar index into the series. */
  bar: number;
  price: number;
};

/**
 * Bars within `k` of the range edges cannot be evaluated — there is not enough
 * data either side to know whether they are extremes. They are skipped rather
 * than guessed at.
 */
export function findSwings(
  series: Series<string>,
  range: BarRange,
  k = 2,
): Swing[] {
  const out: Swing[] = [];
  const from = Math.max(0, range.from);
  const to = Math.min(series.t.length, range.to);

  for (let i = from + k; i < to - k; i += 1) {
    const bar = barAt(series, i);
    if (!bar) continue;

    let isHigh = true;
    let isLow = true;
    for (let j = i - k; j <= i + k; j += 1) {
      if (j === i) continue;
      const other = barAt(series, j);
      if (!other) {
        isHigh = false;
        isLow = false;
        break;
      }
      if (other.h > bar.h) isHigh = false;
      if (other.l < bar.l) isLow = false;
      if (!isHigh && !isLow) break;
    }

    // A bar can qualify as both inside a very flat stretch. Recording both is
    // honest — it means the neighbourhood has no structure, which is itself
    // information for a range level.
    if (isHigh) out.push({ kind: "high", bar: i, price: bar.h });
    if (isLow) out.push({ kind: "low", bar: i, price: bar.l });
  }

  return out;
}

export function swingHighs(
  series: Series<string>,
  range: BarRange,
  k = 2,
): Swing[] {
  return findSwings(series, range, k).filter((s) => s.kind === "high");
}

export function swingLows(
  series: Series<string>,
  range: BarRange,
  k = 2,
): Swing[] {
  return findSwings(series, range, k).filter((s) => s.kind === "low");
}

/**
 * Whether a sequence of swings is making higher highs and higher lows, lower
 * highs and lower lows, or neither. The structural reading Chapter 2 is about.
 */
export type Structure = "uptrend" | "downtrend" | "range";

export function readStructure(swings: Swing[]): Structure {
  const highs = swings.filter((s) => s.kind === "high").map((s) => s.price);
  const lows = swings.filter((s) => s.kind === "low").map((s) => s.price);
  if (highs.length < 2 || lows.length < 2) return "range";

  const rising = (xs: number[]) =>
    xs.slice(1).filter((x, i) => x > (xs[i] ?? x)).length / (xs.length - 1);

  const highsRising = rising(highs);
  const lowsRising = rising(lows);

  // Two thirds is enough to call it: real structure is rarely monotonic, and
  // demanding every leg would classify almost everything as a range.
  if (highsRising >= 0.66 && lowsRising >= 0.66) return "uptrend";
  if (highsRising <= 0.34 && lowsRising <= 0.34) return "downtrend";
  return "range";
}
