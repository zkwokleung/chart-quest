import type { ComponentType } from "react";
import type { Series } from "@/lib/chart/types";
import type { Grade } from "../grade";
import type { KindModule } from "../kind-module";
import type { AnyLevel, Attempt, LevelKind } from "../schema";
import { classifyKind } from "./classify";
import { markBarsKind } from "./mark-bars";
import { predictNextKind } from "./predict-next";

/**
 * Every kind, keyed by name.
 *
 * This is the one place that legitimately enumerates kinds. The level page and
 * the player dispatch through it and never branch on `level.kind` themselves —
 * the rule that keeps ~73 levels from becoming ~73 components.
 */
export const KINDS = {
  classify: classifyKind,
  "mark-bars": markBarsKind,
  "predict-next": predictNextKind,
} satisfies { [K in LevelKind]: KindModule<K> };

export function kindFor<K extends LevelKind>(kind: K): KindModule<K> {
  return KINDS[kind] as unknown as KindModule<K>;
}

/**
 * A grader and a perfect-attempt builder with their kinds erased.
 *
 * `Level<K>` is not assignable to `Level<LevelKind>` because a misconception's
 * `test` accepts that kind's attempt, and function parameters are contravariant.
 * Erasure is therefore unavoidable at a dispatch boundary — so it happens here,
 * once, behind a runtime check that makes it sound.
 */
type ErasedGrader = (
  attempt: Attempt[LevelKind],
  level: AnyLevel,
  data: Series<string>[],
) => Grade;

type ErasedPerfect = (level: AnyLevel, data: Series<string>[]) => Attempt[LevelKind];

/** Grades a level without the caller needing to know its kind. */
export function gradeAny(
  level: AnyLevel,
  attempt: Attempt[LevelKind],
  data: Series<string>[],
): Grade {
  // Not defensive noise: this catches a component submitting the wrong attempt
  // shape, which the erasure above would otherwise pass to a grader that reads
  // fields the attempt does not have.
  if (attempt.kind !== level.kind) {
    throw new Error(
      `level ${level.id} is a ${level.kind} level but received a ${attempt.kind} attempt`,
    );
  }
  return (KINDS[level.kind].grade as ErasedGrader)(attempt, level, data);
}

/** The attempt a player who did it perfectly would submit. Used by the guards. */
export function perfectAttemptFor(
  level: AnyLevel,
  data: Series<string>[],
): Attempt[LevelKind] {
  return (KINDS[level.kind].perfectAttempt as ErasedPerfect)(level, data);
}

/**
 * What a kind's component looks like once its kind is erased.
 *
 * Same contravariance as above, so the same treatment: the player renders through
 * this and stays free of any knowledge of specific kinds. Every erasure in the
 * level engine lives in this file and nowhere else.
 */
export type ErasedKindProps = {
  level: AnyLevel;
  data: Series<string>[];
  hintsUsed: number;
  grade: Grade | null;
  attempt: Attempt[LevelKind] | null;
  onCommit: (attempt: Attempt[LevelKind]) => void;
};

export function componentFor(level: AnyLevel): ComponentType<ErasedKindProps> {
  return KINDS[level.kind].Component as ComponentType<ErasedKindProps>;
}
