import type { Series } from "@/lib/chart/types";
import { diagnose, f1, starsFor, type Grade } from "../../grade";
import type { Attempt, Level } from "../../schema";

/**
 * Single-select is exact match; multi-select is F1 so that ticking every option
 * cannot win.
 */
export function gradeClassify(
  attempt: Attempt["classify"],
  level: Level<"classify">,
  data: Series<string>[],
): Grade {
  const correct = new Set(level.target.correct);
  const chosen = new Set(attempt.selected);

  let hit = 0;
  for (const id of chosen) if (correct.has(id)) hit += 1;

  const score = level.config.multiple
    ? f1(hit, correct.size, chosen.size)
    : chosen.size === 1 && hit === 1
      ? 1
      : 0;

  return {
    score,
    stars: starsFor(score, level.stars, attempt.hintsUsed),
    diagnosis: diagnose(attempt, level, data),
    reference: {
      kind: "options",
      correct: [...correct],
      chosen: [...chosen],
    },
  };
}

export function perfectClassify(level: Level<"classify">): Attempt["classify"] {
  return { kind: "classify", selected: [...level.target.correct], hintsUsed: 0 };
}

/**
 * Bars to animate in once the answer is committed.
 *
 * Lives beside the grader rather than in a kind index because `lib/levels/kinds` loads
 * behaviour statically and components lazily — anything the registry reads eagerly has to sit
 * on a path that pulls in no React. See the note at the top of `kinds/index.ts`.
 */
export function revealHorizonClassify(level: Level<"classify">): number {
  // Committing extends the chart to show what happened next — the payoff for having taken a
  // position on the question. 3.4 reveals all six of its charts.
  return level.config.revealBars ?? 0;
}
