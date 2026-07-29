import type { AnyLevel, Attempt, Level, LevelKind } from "../schema";
import type { Grade } from "../grade";
import type { KindModule } from "../kinds";
import type { Series } from "@/lib/chart/types";
import { classifyKind } from "./classify";
import { markBarsKind } from "./mark-bars";
import { predictNextKind } from "./predict-next";

/**
 * Every kind, keyed by name. The level page dispatches through this and holds no
 * kind-specific logic itself — the rule that keeps ~73 levels from becoming ~73
 * components.
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
 * Grades a level without the caller needing to know its kind.
 *
 * The cast is confined here: `AnyLevel` is a union, and TypeScript cannot see
 * that a level's `kind` selects the matching grader's attempt type. Narrowing
 * once in this helper keeps every call site type-safe.
 */
export function gradeAny(level: AnyLevel, attempt: Attempt[LevelKind], data: Series<string>[]): Grade {
  const kindModule = KINDS[level.kind] as KindModule<LevelKind>;
  return kindModule.grade(attempt, level as Level<LevelKind>, data);
}

export function perfectAttemptFor(
  level: AnyLevel,
  data: Series<string>[],
): Attempt[LevelKind] {
  const kindModule = KINDS[level.kind] as KindModule<LevelKind>;
  return kindModule.perfectAttempt(level as Level<LevelKind>, data);
}
