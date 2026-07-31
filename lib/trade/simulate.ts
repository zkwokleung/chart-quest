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
  /**
   * Move the stop up behind price once the trade is far enough ahead.
   *
   * Chapter 7.7's subject. `afterR` is how far in R the trade must be before the stop starts
   * moving, and `distanceR` is how far behind the best price reached it then sits. A trail is
   * off unless this is given, so every existing level simulates exactly as before.
   */
  trail?: { afterR: number; distanceR: number };
  /**
   * Close part of the position at a level, and let the rest run.
   *
   * `fraction` of the position exits at `atR`; the remainder continues to the stop, the target
   * or the time limit. The reported `r` is then the weighted blend of the two exits, which is
   * what the trade actually returned.
   */
  partial?: { atR: number; fraction: number };
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
  /**
   * Where the stop ended up, which differs from the plan's only when trailing.
   *
   * Surfaced so a score card can show that the stop moved, and so a test can assert it moved
   * only in the trade's favour — a trail that ever loosens is a bug, not a strategy.
   */
  finalStop: number;
  /** The partial exit, when the plan asked for one and price reached it. */
  partial?: { bar: number; price: number; r: number; fraction: number };
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
  const priceAtR = (r: number) =>
    long ? entryPrice + risk * r : entryPrice - risk * r;
  const last = Math.min(series.t.length - 1, entryBar + Math.max(1, maxBars));

  /**
   * The live stop, which a trail may move. Never widened.
   *
   * Moved at the *end* of a bar rather than inside it, and that ordering is the whole
   * correctness question: using this bar's high to move the stop and then testing that stop
   * against this bar's low would assume price reached the high first, which six OHLC numbers
   * cannot say. It is the same ambiguity Rule 2 resolves, in a place where it is easier to get
   * wrong — a trail that peeks makes almost every trade look protected.
   *
   * **The cost is a one-bar lag, and it is the honest cost.** On a bar running 100 → 130 → 100,
   * an intra-bar trail 0.5R behind the high would claim a fill near 125 for +2.5R. This one
   * moves the stop to 125 at the bar's end and fills at the next open, which was 101: +0.1R.
   * A 2.4R difference on one trade, and the smaller number is the one OHLC can support.
   */
  let stop = plan.stop;
  let partial: TradeOutcome["partial"];
  const partialLevel =
    plan.partial && plan.partial.fraction > 0 && plan.partial.fraction < 1
      ? priceAtR(plan.partial.atR)
      : null;

  /** Blends a partial exit with the final one, by the fraction each closed. */
  const blend = (finalR: number) =>
    partial
      ? partial.r * partial.fraction + finalR * (1 - partial.fraction)
      : finalR;

  for (let i = entryBar + 1; i <= last; i += 1) {
    const bar = barAt(series, i);
    if (!bar) break;

    // Rule 1 — a gap past the stop fills at the open. The market never traded at
    // the stop price, so pretending it did would invent a fill that did not exist
    // and hide the worst thing that can happen to a stop.
    const gappedStop = long ? bar.o <= stop : bar.o >= stop;
    if (gappedStop) {
      return {
        entryBar,
        entryPrice,
        exitBar: i,
        exitPrice: bar.o,
        r: blend(rOf(bar.o)),
        risk,
        reason: "stop",
        gapped: true,
        ambiguous: false,
        finalStop: stop,
        partial,
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
        r: blend(rOf(bar.o)),
        risk,
        reason: "target",
        gapped: true,
        ambiguous: false,
        finalStop: stop,
        partial,
      };
    }

    const hitStop = long ? bar.l <= stop : bar.h >= stop;
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
        exitPrice: stop,
        r: blend(rOf(stop)),
        risk,
        reason: "stop",
        gapped: false,
        ambiguous: hitTarget,
        finalStop: stop,
        partial,
      };
    }

    if (hitTarget && target !== null) {
      return {
        entryBar,
        entryPrice,
        exitBar: i,
        exitPrice: target,
        r: blend(rOf(target)),
        risk,
        reason: "target",
        gapped: false,
        ambiguous: false,
        finalStop: stop,
        partial,
      };
    }

    // The bar survived, so its extremes may now act — on the *next* bar.
    //
    // A partial is taken first: if this bar reached the partial level and did not reach the
    // stop, part of the position is closed at that level. A bar containing both was already
    // handled above as a stop, pessimistically, so a partial can never be credited on a bar
    // that also stopped the trade out.
    if (partialLevel !== null && !partial && plan.partial) {
      const reached = long ? bar.h >= partialLevel : bar.l <= partialLevel;
      if (reached) {
        partial = {
          bar: i,
          price: partialLevel,
          r: rOf(partialLevel),
          fraction: plan.partial.fraction,
        };
      }
    }

    if (plan.trail) {
      const best = long ? bar.h : bar.l;
      const bestR = rOf(best);
      if (bestR >= plan.trail.afterR) {
        const candidate = long
          ? best - risk * plan.trail.distanceR
          : best + risk * plan.trail.distanceR;
        // Only ever tightened. A stop that can loosen is not a stop.
        stop = long ? Math.max(stop, candidate) : Math.min(stop, candidate);
      }
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
    r: blend(rOf(exitPrice)),
    risk,
    reason: "time",
    gapped: false,
    ambiguous: false,
    finalStop: stop,
    partial,
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
