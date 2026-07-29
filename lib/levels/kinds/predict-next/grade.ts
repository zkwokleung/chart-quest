import { barAt, type Series } from "@/lib/chart/types";
import { diagnose, starsFor, type Grade } from "../../grade";
import type { Attempt, Direction, Level } from "../../schema";

/**
 * What price actually did over the round's horizon, or null if the data runs out.
 *
 * Compares the last visible close against the close `horizon` bars later. The
 * level file never stores this, so the answer cannot be read out of the content.
 */
export function actualDirection(
  series: Series<string> | undefined,
  lastVisibleIndex: number,
  horizon: number,
): Direction | null {
  if (!series) return null;
  const from = barAt(series, lastVisibleIndex);
  const to = barAt(series, lastVisibleIndex + horizon);
  if (!from || !to) return null;
  return to.c >= from.c ? "up" : "down";
}

/**
 * Scores participation, not accuracy.
 *
 * This is deliberate and load-bearing. Boss 1.B exists to show the player they
 * cannot predict yet — they will score near 50% by design. Grading accuracy would
 * either lock the whole game behind a coin flip or teach that a lucky streak is
 * skill. So committing every call earns the stars, and the accuracy is measured,
 * reported and stored for Chapter 9 to hand back.
 */
export function gradePredictNext(
  attempt: Attempt["predict-next"],
  level: Level<"predict-next">,
  data: Series<string>[],
): Grade {
  const rounds = level.data;
  const answered = attempt.calls.filter((c) => c !== null).length;
  const score = rounds.length === 0 ? 1 : answered / rounds.length;

  const actual: Direction[] = [];
  let correct = 0;
  rounds.forEach((slice, i) => {
    const truth = actualDirection(data[i], slice.to - 1, level.config.horizon);
    if (!truth) return;
    actual.push(truth);
    if (attempt.calls[i] === truth) correct += 1;
  });

  const graded = actual.length;
  const accuracy = graded === 0 ? 0 : correct / graded;

  return {
    score,
    stars: starsFor(score, level.stars, attempt.hintsUsed),
    diagnosis: diagnose(attempt, level, data),
    reference: { kind: "calls", actual, called: attempt.calls },
    detail: {
      right: `${correct} of ${graded}`,
      accuracy: Math.round(accuracy * 100),
    },
  };
}

export function perfectPredictNext(
  level: Level<"predict-next">,
  data: Series<string>[],
): Attempt["predict-next"] {
  return {
    kind: "predict-next",
    calls: level.data.map(
      (slice, i) =>
        actualDirection(data[i], slice.to - 1, level.config.horizon) ?? "up",
    ),
    hintsUsed: 0,
  };
}
