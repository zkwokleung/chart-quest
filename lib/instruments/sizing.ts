import type { InstrumentSpec } from "./specs";

/**
 * One formula, four instrument classes.
 *
 * The whole of Chapter 7 rests on this being the *same* arithmetic everywhere, with only the
 * instrument's own numbers changing:
 *
 *   riskPerUnit = |entry − stop| × valuePerPoint
 *   units       = roundToLot(equity × riskPct / riskPerUnit)
 *
 * A player who learns this once can size a coin, a share, a contract and a currency lot. A
 * player who learns "risk 1% means buy $100 of it" has learned Bitcoin.
 */

export type SizingRequest = {
  spec: InstrumentSpec;
  /** Account value, in the instrument's quote currency. */
  equity: number;
  /** Fraction of the account to risk, as a decimal — 0.01 for one percent. */
  riskPct: number;
  entry: number;
  stop: number;
};

export type SizingResult = {
  /** Position size, rounded down to a tradeable increment. */
  units: number;
  /** Currency at risk per unit held, before rounding. */
  riskPerUnit: number;
  /** What the requested risk was, in currency. */
  budget: number;
  /** What the rounded position actually risks. Never more than `budget`. */
  risked: number;
  /** Position value at entry, which is not the same thing as the risk. */
  notional: number;
};

/**
 * Rounds a position size **down** to the instrument's increment.
 *
 * Down, always. Rounding to nearest would let a position exceed the risk the player asked
 * for, and a lesson about position sizing that quietly risks more than its own budget is
 * teaching the opposite of its subject. On gold the difference is a whole contract — 100
 * ounces — so this is not a rounding nicety.
 */
export function roundToLot(units: number, spec: InstrumentSpec): number {
  if (!Number.isFinite(units) || units <= 0) return 0;
  const lots = Math.floor(units / spec.lotSize);
  // Re-multiplying introduces float dust at 1e-8, so the result is snapped to the same
  // number of decimals the lot size has.
  const decimals = Math.max(0, Math.ceil(-Math.log10(spec.lotSize)));
  return Number((lots * spec.lotSize).toFixed(decimals));
}

/**
 * How large a position the requested risk buys.
 *
 * Returns zero units when the stop sits at the entry: there is no risk to divide by, and the
 * honest answer to "how big a position risks 1% with no stop distance" is that the question
 * has no answer rather than that the position is infinite.
 */
export function sizePosition(request: SizingRequest): SizingResult {
  const { spec, equity, riskPct, entry, stop } = request;
  const distance = Math.abs(entry - stop);
  const riskPerUnit = distance * spec.valuePerPoint;
  const budget = equity * riskPct;

  if (!(riskPerUnit > 0) || !(budget > 0)) {
    return { units: 0, riskPerUnit, budget: Math.max(0, budget), risked: 0, notional: 0 };
  }

  const units = roundToLot(budget / riskPerUnit, spec);
  return {
    units,
    riskPerUnit,
    budget,
    risked: units * riskPerUnit,
    notional: units * entry * spec.valuePerPoint,
  };
}

/**
 * Risk in currency for a position already chosen.
 *
 * The inverse question, and the one 7.1 asks: given this many units and this stop, what is
 * one R worth?
 */
export function riskOf(
  spec: InstrumentSpec,
  units: number,
  entry: number,
  stop: number,
): number {
  return Math.abs(entry - stop) * spec.valuePerPoint * units;
}

/**
 * The win rate a reward:risk ratio needs before it makes money.
 *
 * `1 / (1 + rr)`. Chapter 7's most useful piece of arithmetic and the subject of 7.5: 50% at
 * 1:1, 33.3% at 2:1, 25% at 3:1. Nothing about it is empirical, which is what makes it a
 * threshold a measured hit rate can be held against.
 */
export function breakevenWinRate(rewardRisk: number): number | null {
  if (!Number.isFinite(rewardRisk) || rewardRisk <= 0) return null;
  return 1 / (1 + rewardRisk);
}

/**
 * Expectancy in R, from a win rate and a reward:risk.
 *
 * What 7.B is scored on rather than profit. A player who runs ten trades at sane size and
 * finishes slightly down has done the thing correctly; one who doubled the account on two
 * oversized winners has not, and a score that could not tell them apart would be teaching
 * the wrong lesson at the end of the risk chapter.
 */
export function expectancyR(winRate: number, rewardRisk: number): number {
  return winRate * rewardRisk - (1 - winRate);
}

/**
 * What is left of an account after a run of losses at a fixed fractional risk.
 *
 * Multiplicative, which is the entire point: thirteen losses at 1% leaves 87.8% and needs
 * 13.9% to recover, while the same thirteen at 5% leaves 51.3% and needs 94.9%. The streak
 * is the same streak — 7.6 shows the same one twice — and only the sizing differs.
 */
export function afterLosses(riskPct: number, losses: number): number {
  if (riskPct <= 0 || losses <= 0) return 1;
  return (1 - riskPct) ** losses;
}

/** The gain needed to return to breakeven from a drawdown. */
export function recoveryNeeded(remaining: number): number {
  if (remaining <= 0) return Infinity;
  return 1 / remaining - 1;
}
