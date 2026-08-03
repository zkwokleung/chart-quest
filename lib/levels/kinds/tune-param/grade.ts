import type { Series } from "@/lib/chart/types";
import { diagnose, starsFor, type Grade } from "../../grade";
import type { Attempt, Level } from "../../schema";
import {
  exploredFraction as sweepFraction,
  scoreAgainstTarget,
  scoreExploration,
} from "../slider";

/**
 * Scoring a slider, two different ways, because two different questions are being
 * asked.
 *
 * Most of these levels have a measured answer — 5.2's moving-average period, 9.5's
 * overfitted threshold — and the slider should find it.
 *
 * Level 5.1 does not. It teaches that a shorter average lags less and whipsaws
 * more, which is a trade-off rather than a puzzle: there is no winning period, and
 * a level claiming otherwise would be teaching a falsehood in the very chapter
 * about not trusting indicators. So it scores **exploration** — whether the player
 * moved across enough of the range to have seen the effect — the same call
 * `predict-next` makes in scoring participation rather than accuracy.
 *
 * The arithmetic lives in `../slider.ts` because `probe` grades the same two ways for the
 * same reasons, and two copies of a decay curve diverge the first time one is tuned.
 */

export function exploredFraction(
  attempt: Attempt["tune-param"],
  level: Level<"tune-param">,
): number {
  return sweepFraction(
    attempt.visited,
    attempt.value,
    level.config.min,
    level.config.max,
  );
}

export function gradeTuneParam(
  attempt: Attempt["tune-param"],
  level: Level<"tune-param">,
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
        // Null rather than the target: this level has no right answer, and showing
        // one as the "correction" would undo the lesson at the last moment.
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
  const distance = Math.abs(attempt.value - target);
  const score = scoreAgainstTarget(attempt.value, target, level.tolerance.slop);

  return {
    score,
    stars: starsFor(score, level.stars, attempt.hintsUsed),
    diagnosis,
    reference: { kind: "param", chosen: attempt.value, target, explored },
    detail: {
      [level.config.label]: attempt.value,
      answer: target,
      off: distance === 0 ? "exact" : `${distance} away`,
    },
  };
}

export function perfectTuneParam(
  level: Level<"tune-param">,
): Attempt["tune-param"] {
  const { min, max, scoring } = level.config;
  // An exploration level is won by having looked, so the reference attempt has to
  // have looked — otherwise the winnability guard would fail a correct level.
  return {
    kind: "tune-param",
    value: scoring === "exploration" ? max : level.target.value,
    visited: [min, max],
    hintsUsed: 0,
  };
}
