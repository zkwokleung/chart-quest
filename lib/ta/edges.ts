import type { Series } from "@/lib/chart/types";
import { simulate } from "@/lib/trade/simulate";
import { atr } from "./atr";

/**
 * Four trading rules, run identically on every market, so the market is the only variable.
 *
 * Chapter 8 keeps asking the same question — does this behave differently *here*? — and the
 * only honest way to answer it is one rule, six markets, nothing else changed. So the rules
 * live here as data rather than inside four levels, and 8.3, 8.5, 8.6 and the boss all read
 * the same measurement instead of four that might drift apart.
 *
 * **The rules are deliberately plain.** Each is two or three conditions a player has already
 * met in Chapters 2 to 6. A cleverer rule would measure the rule; these measure the market,
 * which is the point. Every one takes the same 2 ATR stop and the same 2R target, entering
 * only when flat, so their results are comparable to each other and to Chapter 7's figures.
 *
 * **What the measurement found, and why it shapes three levels.** The rule is profitable on
 * all six markets, which is not "six outcomes" — but the per-trade spread is fifty-fold, and
 * the ordering does not follow trend persistence: Apple leads while Bitcoin, the only market
 * that persists at all, is fourth. The single cleanest result is structural rather than
 * statistical: `gap-fill` finds **zero** setups on Bitcoin across 2,778 bars, because a market
 * that never closes cannot gap. That is asset character with no sample size attached to it.
 */

/** Risk, in ATR, on every edge. Fixed so the market is the only thing that varies. */
export const STOP_ATR = 2;

/** Reward:risk on every edge. */
export const TARGET_R = 2;

/** Bars a position may stay open. */
export const MAX_BARS = 60;

/** Bars of history each rule needs before its first possible signal. */
const WARMUP = 210;

export type EdgeId = "breakout-20" | "pullback-ma" | "revert-3down" | "gap-fill";

export type Edge = {
  id: EdgeId;
  label: string;
  /** Stated in full, because a result is meaningless without the rule that produced it. */
  definition: string;
  /** True when bar `i` triggers. Reads `i` and earlier only. */
  triggers: (series: Series<string>, i: number) => boolean;
};

function sma(series: Series<string>, i: number, n: number): number | null {
  if (i - n + 1 < 0) return null;
  let total = 0;
  for (let k = i - n + 1; k <= i; k += 1) {
    const c = series.c[k];
    if (c === undefined) return null;
    total += c;
  }
  return total / n;
}

export const EDGES: readonly Edge[] = [
  {
    id: "breakout-20",
    label: "Breakout",
    definition:
      "Close above the highest high of the previous 20 bars. Chapter 2's break, mechanised.",
    triggers: (s, i) => {
      let highest = -Infinity;
      for (let k = i - 20; k < i; k += 1) highest = Math.max(highest, s.h[k]!);
      return s.c[i]! > highest;
    },
  },
  {
    id: "pullback-ma",
    label: "Pullback to the average",
    definition:
      "In an uptrend by the 50-bar average, price dips to the 20-bar average intrabar and " +
      "closes back above it. Chapter 5's moving average used as support.",
    triggers: (s, i) => {
      const fast = sma(s, i, 20);
      const slow = sma(s, i, 50);
      if (fast === null || slow === null) return false;
      return s.c[i]! > slow && s.l[i]! <= fast && s.c[i]! > fast;
    },
  },
  {
    id: "revert-3down",
    label: "Three down days",
    definition:
      "Three consecutive lower closes while price is above its 200-bar average — buying a " +
      "dip inside an uptrend rather than catching a falling knife.",
    triggers: (s, i) => {
      const trend = sma(s, i, 200);
      if (trend === null) return false;
      return (
        s.c[i]! < s.c[i - 1]! &&
        s.c[i - 1]! < s.c[i - 2]! &&
        s.c[i - 2]! < s.c[i - 3]! &&
        s.c[i]! > trend
      );
    },
  },
  {
    id: "gap-fill",
    label: "Gap up from a gap down",
    definition:
      "The bar opens below the previous bar's low and closes above its own open — a gap " +
      "down that started to fill. Chapter 1.6's gap, traded.",
    triggers: (s, i) => s.o[i]! < s.l[i - 1]! && s.c[i]! > s.o[i]!,
  },
];

export type EdgeResult = {
  trades: number;
  totalR: number;
  perTradeR: number;
  /** Share of trades reaching the target. */
  hitRate: number;
  /** Total R per calendar year the rule traded in, keyed by year. */
  byYear: Record<string, number>;
};

/**
 * One edge on one market, taken in sequence with no overlapping positions.
 *
 * Sequential because that is what a person could have done, and because overlapping entries
 * inflate the count with the same move counted several times — the difference that made
 * Chapter 6 and Chapter 7 report different hit rates for what looked like one rule.
 */
export function runEdge(
  series: Series<string>,
  edge: Edge,
  window?: { from: number; to: number },
): EdgeResult {
  const rs: number[] = [];
  const byYear: Record<string, number> = {};

  let cursor = Math.max(WARMUP, window?.from ?? WARMUP);
  const end = Math.min(series.c.length - MAX_BARS - 1, window?.to ?? Infinity);

  while (cursor < end) {
    const volatility = atr(series, cursor, 14);
    if (volatility <= 0 || !edge.triggers(series, cursor)) {
      cursor += 1;
      continue;
    }

    const entry = series.c[cursor]!;
    const outcome = simulate(
      {
        side: "long",
        stop: entry - volatility * STOP_ATR,
        target: entry + volatility * STOP_ATR * TARGET_R,
      },
      series,
      cursor,
      MAX_BARS,
    );
    if (!outcome) {
      cursor += 1;
      continue;
    }

    rs.push(outcome.r);
    const year = String(new Date(series.t[cursor]!).getUTCFullYear());
    byYear[year] = (byYear[year] ?? 0) + outcome.r;
    cursor = outcome.exitBar + 1;
  }

  const totalR = rs.reduce((total, r) => total + r, 0);
  return {
    trades: rs.length,
    totalR,
    perTradeR: rs.length === 0 ? 0 : totalR / rs.length,
    hitRate:
      rs.length === 0 ? 0 : rs.filter((r) => r >= TARGET_R - 0.1).length / rs.length,
    byYear,
  };
}
