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
