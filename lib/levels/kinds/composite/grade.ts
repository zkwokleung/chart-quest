import type { Series } from "@/lib/chart/types";
import { diagnose, starsFor, type Grade } from "../../grade";
import type { Attempt, DiagnosisEntry, Level } from "../../schema";
import { gradeStep, perfectStep } from "./step-graders";
import { stepAsAnyLevel, weightsOf } from "./steps";

/**
 * Grades a boss as the weighted average of its steps.
 *
 * Weighted rather than equal because `predict-next` scores participation, so at
 * equal weights it would contribute a guaranteed share and quietly lower the bar
 * for the other stages. No per-step floor: a boss should test the chapter, not
 * wall a player who is weak at exactly one thing.
 */
export function gradeComposite(
  attempt: Attempt["composite"],
  level: Level<"composite">,
  data: Series<string>[],
): Grade {
  const steps = level.config.steps;
  const weights = weightsOf(steps);

  const stepDiagnoses: DiagnosisEntry[] = [];
  const detail: Record<string, string> = {};
  let weighted = 0;

  steps.forEach((step, i) => {
    const weight = weights[i] ?? 0;
    const submitted = attempt.steps[i];
    const label = `${i + 1}. ${step.kind}`;

    if (!submitted) {
      detail[label] = `not attempted × ${Math.round(weight * 100)}%`;
      return;
    }

    const grade = gradeStep(step.kind, submitted, stepAsAnyLevel(level, step), data);
    weighted += grade.score * weight;
    detail[label] = `${Math.round(grade.score * 100)}% × ${Math.round(weight * 100)}%`;

    // Prefixed with the stage, so a player reading four explanations knows which
    // part of the boss each belongs to.
    for (const entry of grade.diagnosis) {
      stepDiagnoses.push({
        ...entry,
        id: `${i}-${entry.id}`,
        message: `${step.brief} — ${entry.message}`,
      });
    }
  });

  const score = Math.max(0, Math.min(1, weighted));

  return {
    score,
    stars: starsFor(score, level.stars, attempt.hintsUsed),
    diagnosis: [...diagnose(attempt, level, data), ...stepDiagnoses],
    reference: { kind: "none" },
    detail,
  };
}

export function perfectComposite(
  level: Level<"composite">,
  data: Series<string>[],
): Attempt["composite"] {
  return {
    kind: "composite",
    steps: level.config.steps.map((step) =>
      perfectStep(step.kind, stepAsAnyLevel(level, step), data),
    ),
    hintsUsed: 0,
  };
}
