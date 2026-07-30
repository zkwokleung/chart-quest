import { barAt, type Series } from "@/lib/chart/types";

/**
 * Bar-by-bar trade simulation with no look-ahead.
 *
 * Every decision reads only the bar it is on. The three rules below are the whole
 * of the correctness risk, and each one resolves an ambiguity in the *pessimistic*
 * direction — because the player is learning to read backtest results, and a
 * simulator that flatters them teaches a habit that will cost them money later.
 */

export type TradeSide = "long" | "short";

/**
 * What the player committed to.
 *
 * There is no `entry` field. Entry is the close of the bar the player committed
 * on, derived here rather than supplied, so a fill can never be better than the
 * price that was on screen when they decided. Making that structural rather than a
 * convention is the point.
 */
export type TradePlan = {
  side: TradeSide;
  stop: number;
  /** Null means "no target": the trade runs to the stop or the time limit. */
  target: number | null;
};

export type ExitReason = "stop" | "target" | "time";

export type TradeOutcome = {
  entryBar: number;
  entryPrice: number;
  exitBar: number;
  exitPrice: number;
  /** Risk-multiples. −1 is a clean stop-out; worse than −1 means a gap. */
  r: number;
  /** Price risked per unit: the distance from entry to stop. */
  risk: number;
  reason: ExitReason;
  /**
   * The exit filled at the open because price gapped past the level.
   *
   * A modifier rather than its own reason: the trade still ended at the stop or
   * the target conceptually, and what matters is that the fill was not the price
   * asked for. Level 1.6 teaches that a stop does not protect across a gap; this
   * is where the game has to mean it.
   */
  gapped: boolean;
  /**
   * The exit bar's range contained both the stop and the target.
   *
   * Scored as a stop, and surfaced so the score card can say so. OHLC cannot say
   * which came first, and assuming the good one is how a backtest quietly inflates
   * every result it ever produces.
   */
  ambiguous: boolean;
};

/**
 * Walks a trade forward from the bar it was committed on.
 *
 * Returns null when the plan cannot be simulated at all: no such bar, or a stop on
 * the wrong side of entry. That is a planning error rather than an outcome, and
 * the grader reports it as one instead of scoring a trade that never existed.
 */
export function simulate(
  plan: TradePlan,
  series: Series<string>,
  entryBar: number,
  maxBars: number,
): TradeOutcome | null {
  const entryCandle = barAt(series, entryBar);
  if (!entryCandle) return null;

  const entryPrice = entryCandle.c;
  const long = plan.side === "long";
  const risk = long ? entryPrice - plan.stop : plan.stop - entryPrice;
  if (!(risk > 0)) return null;

  // A target on the wrong side is not a target. Treated as absent so the trade
  // still runs, and the plan grader is what penalises it.
  const target =
    plan.target !== null &&
    (long ? plan.target > entryPrice : plan.target < entryPrice)
      ? plan.target
      : null;

  const rOf = (exit: number) =>
    (long ? exit - entryPrice : entryPrice - exit) / risk;
  const last = Math.min(series.t.length - 1, entryBar + Math.max(1, maxBars));

  for (let i = entryBar + 1; i <= last; i += 1) {
    const bar = barAt(series, i);
    if (!bar) break;

    // Rule 1 — a gap past the stop fills at the open. The market never traded at
    // the stop price, so pretending it did would invent a fill that did not exist
    // and hide the worst thing that can happen to a stop.
    const gappedStop = long ? bar.o <= plan.stop : bar.o >= plan.stop;
    if (gappedStop) {
      return {
        entryBar,
        entryPrice,
        exitBar: i,
        exitPrice: bar.o,
        r: rOf(bar.o),
        risk,
        reason: "stop",
        gapped: true,
        ambiguous: false,
      };
    }

    // The same rule in the player's favour, for symmetry: a gap past the target
    // also fills at the open, which is better than the target rather than worse.
    if (target !== null && (long ? bar.o >= target : bar.o <= target)) {
      return {
        entryBar,
        entryPrice,
        exitBar: i,
        exitPrice: bar.o,
        r: rOf(bar.o),
        risk,
        reason: "target",
        gapped: true,
        ambiguous: false,
      };
    }

    const hitStop = long ? bar.l <= plan.stop : bar.h >= plan.stop;
    const hitTarget =
      target !== null && (long ? bar.h >= target : bar.l <= target);

    // Rule 2 — when one bar contains both, the stop wins. Six OHLC numbers cannot
    // order two events inside a bar, and resolving it optimistically is the single
    // commonest way a backtest lies.
    if (hitStop) {
      return {
        entryBar,
        entryPrice,
        exitBar: i,
        exitPrice: plan.stop,
        r: rOf(plan.stop),
        risk,
        reason: "stop",
        gapped: false,
        ambiguous: hitTarget,
      };
    }

    if (hitTarget && target !== null) {
      return {
        entryBar,
        entryPrice,
        exitBar: i,
        exitPrice: target,
        r: rOf(target),
        risk,
        reason: "target",
        gapped: false,
        ambiguous: false,
      };
    }
  }

  // Rule 3 — out of bars. Closed at the last close available, which is what a
  // trade still open at the end of the replay is actually worth.
  const finalBar = barAt(series, last);
  const exitPrice = finalBar?.c ?? entryPrice;
  return {
    entryBar,
    entryPrice,
    exitBar: last,
    exitPrice,
    r: rOf(exitPrice),
    risk,
    reason: "time",
    gapped: false,
    ambiguous: false,
  };
}

/** Reward:risk implied by a plan, or null when there is no target. */
export function rewardRisk(plan: TradePlan, entryPrice: number): number | null {
  if (plan.target === null) return null;
  const long = plan.side === "long";
  const risk = long ? entryPrice - plan.stop : plan.stop - entryPrice;
  const reward = long ? plan.target - entryPrice : entryPrice - plan.target;
  if (!(risk > 0) || !(reward > 0)) return null;
  return reward / risk;
}
