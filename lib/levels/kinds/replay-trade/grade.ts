import { priceAtBar, type Drawing } from "@/lib/chart/geometry";
import { barAt, type Series } from "@/lib/chart/types";
import { atr } from "@/lib/ta/atr";
import {
  rewardRisk,
  simulate,
  type TradeOutcome,
  type TradePlan,
} from "@/lib/trade/simulate";
import { diagnose, starsFor, type Grade, type Stars } from "../../grade";
import type { Attempt, Level } from "../../schema";

/**
 * Scoring a trade on two axes, and letting only one of them award stars.
 *
 * The plan carries 0.7 and the outcome 0.3, and stars are additionally capped at
 * one whenever the plan scores below half. The requirement is epic #23's: a
 * profitable trade with a stop in a stupid place gets one star, because a player
 * who learns otherwise has learned the exact habit this game exists to cure.
 *
 * The reverse matters just as much: a well-planned trade that lost still clears two
 * stars. Punishing it would teach that being right is the same as being good.
 *
 * **Which of the two mechanisms is actually doing the work, stated rather than
 * assumed:** the weighting. With a 0.3 outcome share and Chapter 3's thresholds, a
 * plan must score 0.571 to reach two stars even on a perfect outcome — already
 * above `PLAN_FLOOR`, so the cap never fires today. It is kept because #32 retunes
 * star thresholds against real play data, and if the two-star gate drops below 0.7
 * the cap becomes the only thing between a lucky winner and a pass. The test
 * asserts the invariant rather than the arithmetic that happens to deliver it.
 */

const PLAN_WEIGHT = 0.7;
const OUTCOME_WEIGHT = 0.3;

/** Below this, the plan was not good enough for the outcome to speak for it. */
const PLAN_FLOOR = 0.5;

/** R at which the outcome component is full. Above 2R is luck as much as skill. */
const OUTCOME_FULL_R = 2;

export type PlanBreakdown = {
  /** The stop is on the far side of the structure the setup rests on. */
  beyondStructure: boolean;
  /** Room between entry and stop, in ATR multiples. */
  roomAtr: number;
  roomOk: boolean;
  rewardRisk: number | null;
  rrOk: boolean;
  /** Entered within `barSlop` of the bar the setup actually triggered on. */
  onTime: boolean;
  score: number;
};

/**
 * How far a structure sits from a price, on the side that matters.
 *
 * A zone's relevant edge for a long is its bottom: the stop belongs below the whole
 * zone, not inside it. For a level or a trendline there is one price to clear.
 */
export function structurePrice(
  structure: Drawing,
  bar: number,
  side: "long" | "short",
): number | null {
  if (structure.shape === "zone") {
    return side === "long" ? structure.bottom : structure.top;
  }
  return priceAtBar(structure, bar);
}

export function measurePlan(
  attempt: Attempt["replay-trade"],
  level: Level<"replay-trade">,
  series: Series<string>,
): PlanBreakdown | null {
  const entry = barAt(series, attempt.entryBar)?.c;
  if (entry === undefined) return null;

  const { side, minRR } = level.config;
  const { minAtr, maxAtr, barSlop } = level.tolerance;
  const long = side === "long";
  const risk = long ? entry - attempt.stop : attempt.stop - entry;

  const edge = structurePrice(level.target.structure, attempt.entryBar, side);
  const beyondStructure =
    edge === null ? false : long ? attempt.stop < edge : attempt.stop > edge;

  const volatility = atr(
    series,
    attempt.entryBar,
    level.config.atrPeriod ?? 14,
  );
  // No volatility estimate means no opinion on room, rather than a free pass or an
  // automatic failure — see the note on atr() returning 0.
  const roomAtr = volatility > 0 ? risk / volatility : 0;
  const roomOk = volatility > 0 ? roomAtr >= minAtr && roomAtr <= maxAtr : true;

  const plan: TradePlan = { side, stop: attempt.stop, target: attempt.target };
  const rr = rewardRisk(plan, entry);
  const rrOk = rr !== null && rr >= minRR;

  const onTime =
    Math.abs(attempt.entryBar - level.target.triggerBar) <= barSlop;

  // Four equal quarters. Weighting them further would be inventing precision the
  // content has not earned yet; #32's calibration pass is the place for that.
  const score =
    (Number(beyondStructure) + Number(roomOk) + Number(rrOk) + Number(onTime)) /
    4;

  return {
    beyondStructure,
    roomAtr,
    roomOk,
    rewardRisk: rr,
    rrOk,
    onTime,
    score,
  };
}

function outcomeScore(outcome: TradeOutcome): number {
  if (outcome.r <= 0) return 0;
  return Math.min(1, outcome.r / OUTCOME_FULL_R);
}

function describeOutcome(outcome: TradeOutcome): string {
  const r = `${outcome.r >= 0 ? "+" : ""}${outcome.r.toFixed(2)}R`;
  if (outcome.gapped) {
    return outcome.reason === "stop"
      ? `${r} — price gapped straight through your stop and filled at the open`
      : `${r} — price gapped past your target, filling better than you asked`;
  }
  if (outcome.ambiguous) {
    return `${r} — that bar reached both your stop and your target, and is scored as a stop`;
  }
  if (outcome.reason === "time")
    return `${r} — still open when the replay ran out`;
  return outcome.reason === "stop" ? `${r} — stopped out` : `${r} — target hit`;
}

export function gradeReplayTrade(
  attempt: Attempt["replay-trade"],
  level: Level<"replay-trade">,
  data: Series<string>[],
): Grade {
  const series = data[0];
  const slice = level.data[0];
  const structure = level.target.structure;

  const empty = {
    kind: "trade" as const,
    structure,
    entryPrice: 0,
    stop: attempt.stop,
    target: attempt.target,
    exitBar: 0,
    exitPrice: 0,
    r: 0,
    outcome: "not simulated",
  };

  if (!series || !slice) {
    return {
      score: 0,
      stars: 0,
      diagnosis: diagnose(attempt, level, data),
      reference: empty,
    };
  }

  const plan = measurePlan(attempt, level, series);
  const outcome = simulate(
    { side: level.config.side, stop: attempt.stop, target: attempt.target },
    series,
    attempt.entryBar,
    level.config.maxBars,
  );

  // A stop on the wrong side of entry is not a badly-planned trade, it is not a
  // trade — so it scores zero and the diagnosis carries the teaching, the same way
  // a support line sloping the wrong way does in `annotate`.
  if (!plan || !outcome) {
    return {
      score: 0,
      stars: 0,
      diagnosis: diagnose(attempt, level, data),
      reference: empty,
      detail: { plan: "your stop is on the wrong side of your entry" },
    };
  }

  const outcomePart = outcomeScore(outcome);
  const score = plan.score * PLAN_WEIGHT + outcomePart * OUTCOME_WEIGHT;
  const earned = starsFor(score, level.stars, attempt.hintsUsed);
  const capped: Stars =
    plan.score < PLAN_FLOOR ? (Math.min(earned, 1) as Stars) : earned;

  return {
    score,
    stars: capped,
    diagnosis: diagnose(attempt, level, data),
    reference: {
      kind: "trade",
      structure,
      entryPrice: outcome.entryPrice,
      stop: attempt.stop,
      target: attempt.target,
      exitBar: outcome.exitBar,
      exitPrice: outcome.exitPrice,
      r: outcome.r,
      outcome: describeOutcome(outcome),
    },
    detail: {
      plan: `${Math.round(plan.score * 100)}%`,
      outcome: describeOutcome(outcome),
      "stop room":
        plan.roomAtr > 0 ? `${plan.roomAtr.toFixed(2)}× ATR` : "unknown",
      "reward:risk":
        plan.rewardRisk === null ? "no target" : plan.rewardRisk.toFixed(2),
      ...(plan.score < PLAN_FLOOR
        ? {
            capped:
              "the plan was weak, so the result cannot earn more than one star",
          }
        : {}),
    },
  };
}

/**
 * The trade the level was authored around.
 *
 * Enters on the trigger bar with a stop the midpoint of the allowed ATR band
 * beyond the structure, and a target at `minRR`. Used by the winnability guard, so
 * a level whose own tolerances cannot be satisfied fails CI.
 */
export function perfectReplayTrade(
  level: Level<"replay-trade">,
  data: Series<string>[],
): Attempt["replay-trade"] {
  const series = data[0];
  const { side, minRR } = level.config;
  const { minAtr, maxAtr } = level.tolerance;
  const entryBar = level.target.triggerBar;
  const entry = series ? barAt(series, entryBar)?.c : undefined;

  if (!series || entry === undefined) {
    return {
      kind: "replay-trade",
      entryBar,
      stop: 0,
      target: null,
      reason: "reference",
      hintsUsed: 0,
    };
  }

  const edge = structurePrice(level.target.structure, entryBar, side) ?? entry;
  const volatility = atr(series, entryBar, level.config.atrPeriod ?? 14);
  const room = volatility * ((minAtr + maxAtr) / 2);
  const long = side === "long";

  // Measured from the structure, not from entry: the stop's job is to sit beyond
  // the level that would invalidate the idea. Then the room band is checked against
  // entry, which is what keeps the two constraints honest about each other.
  const stopFromStructure = long
    ? edge - volatility * minAtr
    : edge + volatility * minAtr;
  const stopFromEntry = long ? entry - room : entry + room;
  const stop = long
    ? Math.min(stopFromStructure, stopFromEntry)
    : Math.max(stopFromStructure, stopFromEntry);

  const risk = Math.abs(entry - stop);
  const target = long ? entry + risk * minRR : entry - risk * minRR;

  return {
    kind: "replay-trade",
    entryBar,
    stop,
    target,
    reason: "The reference trade for this level.",
    hintsUsed: 0,
  };
}
