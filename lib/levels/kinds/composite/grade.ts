import type { Series } from "@/lib/chart/types";
import { diagnose, starsFor, type Grade } from "../../grade";
import type {
  Attempt,
  DiagnosisEntry,
  Level,
  OverlaySpec,
} from "../../schema";
import type { JournalDraft } from "../../kind-module";
import { tradeDraft } from "../replay-trade/grade";
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
  // One overlay per step, collected so a boss's replay stages can be journalled. These used to
  // be discarded after their scores were read, which is why four bosses' trades never reached
  // the journal at all — a fifth of the record, silently.
  const stepOverlays: OverlaySpec[] = steps.map(() => ({ kind: "none" }));

  steps.forEach((step, i) => {
    const weight = weights[i] ?? 0;
    const submitted = attempt.steps[i];
    const label = `${i + 1}. ${step.kind}`;

    if (!submitted) {
      detail[label] = `not attempted × ${Math.round(weight * 100)}%`;
      return;
    }

    const grade = gradeStep(
      step.kind,
      submitted,
      stepAsAnyLevel(level, step),
      data,
    );
    weighted += grade.score * weight;
    stepOverlays[i] = grade.reference;
    detail[label] =
      `${Math.round(grade.score * 100)}% × ${Math.round(weight * 100)}%`;

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
    reference: { kind: "steps", steps: stepOverlays },
    detail,
  };
}

/**
 * The journal entries a boss's replay stages produced.
 *
 * Four bosses contained a `replay-trade` step whose trade was never recorded, because
 * `composite` carried no journal hook and `gradeComposite` discarded its step overlays. A
 * player who cleared Chapters 1-8 perfectly logged three trades out of seventeen, and the two
 * asset classes that only appear in bosses — fx and futures — never appeared at all.
 *
 * Read off the step overlays this grade already carries rather than re-graded, which is why
 * `gradeComposite` keeps them. Re-grading here would be a second pass whose only purpose is to
 * be able to disagree with the first, and Chapter 9 treats this record as fact.
 *
 * Tagged with the **composite's** stars rather than the step's: a step's own stars are "only
 * ever shown as progress" per `steps.ts`, and a journal entry is keyed by level and attempt.
 */
export function journalEntriesComposite(
  attempt: Attempt["composite"],
  level: Level<"composite">,
  grade: Grade,
): JournalDraft[] {
  if (grade.reference.kind !== "steps") return [];
  const overlays = grade.reference.steps;

  const drafts: JournalDraft[] = [];
  level.config.steps.forEach((step, i) => {
    if (step.kind !== "replay-trade") return;
    const overlay = overlays[i];
    if (overlay?.kind !== "trade") return;

    const submitted = attempt.steps[i];
    if (submitted?.kind !== "replay-trade") return;

    const slice = (step.data ?? level.data)[0];
    if (!slice) return;

    drafts.push(
      tradeDraft({
        levelId: level.id,
        slice,
        side: step.config.side,
        setup: step.config.setup,
        reason: submitted.reason,
        stars: grade.stars,
        trade: overlay,
      }),
    );
  });
  return drafts;
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
