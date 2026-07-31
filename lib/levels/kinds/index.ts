import type { ComponentType } from "react";
import type { ErasedKindProps } from "./erased";
import type { Series } from "@/lib/chart/types";
import type { Grade } from "../grade";
import type { JournalDraft, KindModule } from "../kind-module";
import type { AnyLevel, Attempt, LevelKind } from "../schema";
import { annotateKind } from "./annotate";
import { compositeKind } from "./composite";
import { classifyKind } from "./classify";
import { markBarsKind } from "./mark-bars";
import { predictNextKind } from "./predict-next";
import { replayTradeKind } from "./replay-trade";
import { sortRankKind } from "./sort-rank";
import { spotTheFlawKind } from "./spot-the-flaw";
import { tuneParamKind } from "./tune-param";

/**
 * Every kind, keyed by name.
 *
 * This is the one place that legitimately enumerates kinds. The level page and
 * the player dispatch through it and never branch on `level.kind` themselves —
 * the rule that keeps ~73 levels from becoming ~73 components.
 */
export const KINDS = {
  annotate: annotateKind,
  composite: compositeKind,
  classify: classifyKind,
  "mark-bars": markBarsKind,
  "predict-next": predictNextKind,
  "replay-trade": replayTradeKind,
  "sort-rank": sortRankKind,
  "spot-the-flaw": spotTheFlawKind,
  "tune-param": tuneParamKind,
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

type ErasedPerfect = (
  level: AnyLevel,
  data: Series<string>[],
) => Attempt[LevelKind];

type ErasedJournal = (
  attempt: Attempt[LevelKind],
  level: AnyLevel,
  grade: Grade,
) => JournalDraft | null;

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

/**
 * Bars a level may reveal past the end of each slice.
 *
 * Asked of the kind rather than decided here, so `LevelPlayer` can size a feed's
 * window without knowing what a horizon means for any particular kind.
 */
export function revealHorizonFor(level: AnyLevel): number {
  const horizon = KINDS[level.kind].revealHorizon as
    ((level: AnyLevel) => number) | undefined;
  return Math.max(0, Math.trunc(horizon?.(level) ?? 0));
}

/**
 * Bars a level starts with visible, or null meaning "the whole slice".
 *
 * Asked of the kind for the same reason as the horizon: the level player must not
 * have to know that a replay trade begins part-way through its own window.
 */
export function primedBarsFor(level: AnyLevel): number | null {
  const primed = KINDS[level.kind].primedBars as
    ((level: AnyLevel) => number) | undefined;
  if (!primed) return null;
  return Math.max(1, Math.trunc(primed(level)));
}

/**
 * The journal entry an attempt produces, or null when the kind makes none.
 *
 * Erased like the grader, and for the same contravariance reason.
 */
export function journalEntryFor(
  level: AnyLevel,
  attempt: Attempt[LevelKind],
  grade: Grade,
): JournalDraft | null {
  const build = KINDS[level.kind].journalEntry as ErasedJournal | undefined;
  return build ? build(attempt, level, grade) : null;
}

/** The attempt a player who did it perfectly would submit. Used by the guards. */
export function perfectAttemptFor(
  level: AnyLevel,
  data: Series<string>[],
): Attempt[LevelKind] {
  return (KINDS[level.kind].perfectAttempt as ErasedPerfect)(level, data);
}

export type { ErasedKindProps } from "./erased";

export function componentFor(level: AnyLevel): ComponentType<ErasedKindProps> {
  return KINDS[level.kind].Component as ComponentType<ErasedKindProps>;
}
