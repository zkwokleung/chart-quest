import type { Series } from "@/lib/chart/types";
import { diagnose, starsFor, type Grade } from "../../grade";
import type { Attempt, Level } from "../../schema";
import {
  exploredFraction as sweepFraction,
  scoreAgainstTarget,
  scoreExploration,
} from "../slider";

/**
 * Scoring a measurement the player ran themselves.
 *
 * The kind exists because Chapter 8's question — does this market behave differently, and by
 * how much — is not a chart with a choice on it and not an indicator with a slider on it. It
 * is a statistic computed across the whole spine, redrawn as a control moves. `tune-param`
 * could not carry it: its config *is* `(value) => IndicatorSpec`, and a variance ratio across
 * six markets is not an indicator on one chart. Bending it would have made one kind into two
 * wearing a single name, which is the call 7.5 already refused.
 *
 * **This grader must import nothing from `lib/ta`.** `behaviour.ts` is imported eagerly by
 * every level route, so a grader reaching for the estimators would put the variance-ratio
 * machinery in the shared payload of `/level/1-1`. The measurement is a committed artefact and
 * the component fetches it; the grader only compares two numbers. `probe/grade.test.ts`
 * asserts the import list stays clean.
 *
 * **Why the sweep is scored and not just the answer.** Issue #26 is explicit that 8.2's player
 * must run the probe rather than be handed a conclusion, and a lucky landing on the crossing
 * horizon teaches nothing about horizons. So `visited` is kept and, on an `exploration` level,
 * is the whole score — the same call `tune-param` makes for 5.1 and `predict-next` makes in
 * scoring participation. The arithmetic is shared, in `../slider.ts`.
 */

export function exploredFraction(
  attempt: Attempt["probe"],
  level: Level<"probe">,
): number {
  return sweepFraction(
    attempt.visited,
    attempt.value,
    level.config.min,
    level.config.max,
  );
}

export function gradeProbe(
  attempt: Attempt["probe"],
  level: Level<"probe">,
  data: Series<string>[],
): Grade {
  const explored = exploredFraction(attempt, level);
  const diagnosis = diagnose(attempt, level, data);

  if (level.config.scoring === "exploration") {
    const score = scoreExploration(explored, level.config.exploreFraction ?? 0.6);
    return {
      score,
      stars: starsFor(score, level.stars, attempt.hintsUsed),
      diagnosis,
      reference: {
        kind: "param",
        chosen: attempt.value,
        target: null,
        explored,
      },
      detail: {
        [level.config.label]: attempt.value,
        explored: `${Math.round(explored * 100)}% of the range`,
      },
    };
  }

  const target = level.target.value;
  const accuracy = scoreAgainstTarget(attempt.value, target, level.tolerance.slop);

  /**
   * Accuracy, gated on having looked.
   *
   * Not averaged with the sweep, capped by it: a player who dragged straight to the answer
   * has not measured anything, and 8.2 is a level about measuring. The cap is generous
   * because the sweep is a means rather than the lesson — below the required fraction the
   * score is scaled by how far short it fell, so a nearly-complete sweep barely suffers.
   */
  const required = level.config.exploreFraction ?? 0.6;
  const looked = scoreExploration(explored, required);
  const score = accuracy * looked;

  const distance = Math.abs(attempt.value - target);
  return {
    score,
    stars: starsFor(score, level.stars, attempt.hintsUsed),
    diagnosis,
    reference: { kind: "param", chosen: attempt.value, target, explored },
    detail: {
      [level.config.label]: attempt.value,
      answer: target,
      off: distance === 0 ? "exact" : `${Number(distance.toFixed(2))} away`,
      explored: `${Math.round(explored * 100)}% of the range`,
    },
  };
}

export function perfectProbe(level: Level<"probe">): Attempt["probe"] {
  const { min, max, scoring } = level.config;
  // The reference attempt has to have swept, or the winnability guard would fail a correct
  // level — the accuracy is capped by the sweep, so an answer with no exploration cannot
  // reach three stars, which is the point.
  return {
    kind: "probe",
    value: scoring === "exploration" ? max : level.target.value,
    visited: [min, max],
    hintsUsed: 0,
  };
}
