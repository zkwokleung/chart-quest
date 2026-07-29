import type { Series } from "@/lib/chart/types";
import type { Grade } from "../../grade";
import type { Level, StepAttempt, StepKind } from "../../schema";
import { gradeAnnotate, perfectAnnotate } from "../annotate/grade";
import { gradeClassify, perfectClassify } from "../classify/grade";
import { gradeMarkBars, perfectMarkBars } from "../mark-bars/grade";
import { gradePredictNext, perfectPredictNext } from "../predict-next/grade";

/**
 * Step graders, imported directly rather than through the kind registry.
 *
 * The registry imports the composite, so reaching back through it would form a
 * cycle. These are leaf modules, so there is nothing to work around.
 *
 * Deliberately free of any React import: the purity lint rule covers grader paths,
 * and step *components* live in step-components.ts for that reason.
 */
const GRADERS = {
  annotate: gradeAnnotate,
  classify: gradeClassify,
  "mark-bars": gradeMarkBars,
  "predict-next": gradePredictNext,
} as const;

const PERFECT = {
  annotate: perfectAnnotate,
  classify: perfectClassify,
  "mark-bars": perfectMarkBars,
  "predict-next": perfectPredictNext,
} as const;

type ErasedGrader = (
  attempt: StepAttempt,
  level: Level<StepKind>,
  data: Series<string>[],
) => Grade;

type ErasedPerfect = (level: Level<StepKind>, data: Series<string>[]) => StepAttempt;

export function gradeStep(
  kind: StepKind,
  attempt: StepAttempt,
  level: Level<StepKind>,
  data: Series<string>[],
): Grade {
  return (GRADERS[kind] as ErasedGrader)(attempt, level, data);
}

export function perfectStep(
  kind: StepKind,
  level: Level<StepKind>,
  data: Series<string>[],
): StepAttempt {
  return (PERFECT[kind] as ErasedPerfect)(level, data);
}
