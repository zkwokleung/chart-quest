import type { ComponentType } from "react";
import type { Series } from "@/lib/chart/types";
import type { Grade } from "./grade";
import type { Attempt, Level, LevelKind } from "./schema";

/** What a kind's interactive component receives. */
export type KindProps<K extends LevelKind> = {
  level: Level<K>;
  data: Series<string>[];
  hintsUsed: number;
  /** Null until the player commits; afterwards the UI is read-only. */
  grade: Grade | null;
  attempt: Attempt[K] | null;
  onCommit: (attempt: Attempt[K]) => void;
};

export type Grader<K extends LevelKind> = (
  attempt: Attempt[K],
  level: Level<K>,
  data: Series<string>[],
) => Grade;

/**
 * Everything that defines one interaction kind, in one object.
 *
 * A kind is declared in exactly one place, so adding one cannot leave the
 * registry, the grader map and the component list out of step.
 */
export type KindModule<K extends LevelKind> = {
  kind: K;
  Component: ComponentType<KindProps<K>>;
  grade: Grader<K>;
  /**
   * The attempt a player who did it perfectly would submit.
   *
   * Exists so the authoring guard "every level's own target scores three stars"
   * can be written once, generically, instead of per kind. That guard validates
   * all ~73 levels for free and is the cheapest defence in the project — this
   * function is what makes it possible.
   */
  perfectAttempt: (level: Level<K>, data: Series<string>[]) => Attempt[K];
};
