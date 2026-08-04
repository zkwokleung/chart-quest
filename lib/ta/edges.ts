import { runStrategy, type StrategySpec } from "@/lib/backtest/engine";
import type { Series } from "@/lib/chart/types";

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

/**
 * Bars of history each rule needs before its first possible signal.
 *
 * One figure for all four, set by the longest of them — `revert-3down`'s 200-bar average — rather
 * than per rule, so the four are measured over the same span and the market stays the only
 * variable. A composed Chapter 10 strategy cannot make that simplification, which is why
 * `warmupFor` derives it from the blocks instead.
 */
export const WARMUP = 210;

/**
 * A rule id. The four Chapter 8 rules are concrete; the swept breakout is a template.
 *
 * Widening this to `string` would have been easier and would have cost the exhaustiveness that
 * caught two mislabelled cells while Chapter 8 was authored.
 */
export type EdgeId =
  | "pullback-ma"
  | "revert-3down"
  | "gap-fill"
  | `breakout-${number}`;

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

/**
 * The breakout rule at any lookback, so Chapter 9.5 can sweep it.
 *
 * Chapter 8's `breakout-20` is this at n = 20, and what pins it is
 * `lib/data/asset-character.test.ts`, which recomputes the whole committed artefact from the
 * shipped code and asserts equality — so every one of `breakout-20`'s six per-market cells is
 * covered, not merely the two the levels quote most. (An earlier version of this comment named an
 * `edges.test.ts` that never existed. The drift test is the real guarantee and always was.)
 * 8.3, 8.5, 8.6 and 8.B all quote these figures, and a refactor moving them by a hundredth would
 * make four levels quietly wrong.
 *
 * The lookback is the *only* thing 9.5 varies. One knob is what makes the overfit lesson
 * legible: a player who tunes twenty parameters knows they cheated, and a player who tunes one
 * believes they discovered something.
 */
export function breakoutN(n: number): Edge {
  return {
    id: `breakout-${n}`,
    label: n === 20 ? "Breakout" : `Breakout of ${n} bars`,
    definition: `Close above the highest high of the previous ${n} bars. Chapter 2's break, mechanised.`,
    triggers: (s, i) => {
      let highest = -Infinity;
      for (let k = i - n; k < i; k += 1) highest = Math.max(highest, s.h[k]!);
      return s.c[i]! > highest;
    },
  };
}

export const EDGES: readonly Edge[] = [
  breakoutN(20),
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
  /**
   * Each trade's R, in order.
   *
   * Added for 9.5, which needs a drawdown and therefore the order rather than a total. Additive
   * on purpose: `runEdge` feeds Chapter 8's committed artefact, whose shape four levels' claims
   * tests pin, so the alternative was a second copy of this loop that could drift from it.
   */
  rs: number[];
  trades: number;
  totalR: number;
  perTradeR: number;
  /** Share of trades reaching the target. */
  hitRate: number;
  /** Total R per calendar year the rule traded in, keyed by year. */
  byYear: Record<string, number>;
};

/** Chapter 8's four rules as the engine's `StrategySpec`. Every fixed part of them is here. */
export function specFor(edge: Edge): StrategySpec {
  return {
    entry: edge.triggers,
    side: "long",
    stop: { kind: "atr", multiple: STOP_ATR, period: 14 },
    target: { kind: "r", multiple: TARGET_R },
    timeStopBars: MAX_BARS,
    warmup: WARMUP,
  };
}

/**
 * One edge on one market, taken in sequence with no overlapping positions.
 *
 * **An adapter over `lib/backtest/engine.ts` since M10**, which is that loop with the fixed parts
 * made parameters. The loop lived here first because Chapter 8 needed it and nothing else did; a
 * second copy in `lib/backtest/` would have disagreed with this one in the fifth decimal on gapped
 * bars, and the two committed artefacts this feeds are quoted by nine levels.
 *
 * `EdgeResult` deliberately stays narrower than `StrategyRun`: dropping `outcomes` keeps the shape
 * `asset-character.json` and `edge-sweep.json` are built from exactly as it was, so the refactor
 * could be gated on those files not moving by a single byte.
 */
export function runEdge(
  series: Series<string>,
  edge: Edge,
  window?: { from: number; to: number },
): EdgeResult {
  const { rs, trades, totalR, perTradeR, hitRate, byYear } = runStrategy(
    series,
    specFor(edge),
    window,
  );
  return { rs, trades, totalR, perTradeR, hitRate, byYear };
}
