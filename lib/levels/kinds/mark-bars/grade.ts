import type { Series } from "@/lib/chart/types";
import { diagnose, f1, starsFor, type Grade } from "../../grade";
import { barIndexOf } from "../../mark";
import type { Attempt, Level, Mark } from "../../schema";

/**
 * Pairs each submitted mark with a target, allowing `barSlop` bars of slack.
 *
 * Greedy nearest-first matching, and each target may only be claimed once — three
 * marks clustered on one target must not count as three hits, or a player could
 * shotgun a region and score.
 */
function matchMarks(
  submitted: Mark[],
  targets: Mark[],
  barSlop: number,
): { hit: Mark[]; wrong: Mark[]; missed: Mark[] } {
  const claimed = new Set<number>();
  const hit: Mark[] = [];
  const wrong: Mark[] = [];

  for (const mark of submitted) {
    const markBar = barIndexOf(mark);
    let bestIndex = -1;
    let bestDistance = Infinity;

    targets.forEach((target, i) => {
      if (claimed.has(i)) return;
      const targetBar = barIndexOf(target);

      if (markBar === null || targetBar === null) {
        // Candle parts have no distance — they either match exactly or not.
        if (mark === target && bestDistance > 0) {
          bestIndex = i;
          bestDistance = 0;
        }
        return;
      }
      const distance = Math.abs(markBar - targetBar);
      if (distance <= barSlop && distance < bestDistance) {
        bestIndex = i;
        bestDistance = distance;
      }
    });

    if (bestIndex >= 0) {
      claimed.add(bestIndex);
      hit.push(mark);
    } else {
      wrong.push(mark);
    }
  }

  const missed = targets.filter((_, i) => !claimed.has(i));
  return { hit, wrong, missed };
}

export function gradeMarkBars(
  attempt: Attempt["mark-bars"],
  level: Level<"mark-bars">,
  data: Series<string>[],
): Grade {
  // Duplicates would otherwise inflate the submitted count and depress precision
  // for something the UI already treats as one selection.
  const submitted = [...new Set(attempt.marks)];
  const targets = level.target.marks;

  const { hit, wrong, missed } = matchMarks(
    submitted,
    targets,
    level.tolerance.barSlop,
  );

  // F1 rather than recall: over-marking has to cost, or marking every bar wins.
  const score = f1(hit.length, targets.length, submitted.length);

  return {
    score,
    stars: starsFor(score, level.stars, attempt.hintsUsed),
    diagnosis: diagnose(attempt, level, data),
    reference: { kind: "marks", missed, wrong, hit },
    detail: {
      found: `${hit.length} of ${targets.length}`,
      incorrect: wrong.length,
    },
  };
}

export function perfectMarkBars(level: Level<"mark-bars">): Attempt["mark-bars"] {
  return { kind: "mark-bars", marks: [...level.target.marks], hintsUsed: 0 };
}
