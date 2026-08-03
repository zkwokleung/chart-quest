import type { ComponentType } from "react";
import type { Series } from "@/lib/chart/types";
import type { ReplayFeed } from "@/lib/replay/feed";
import type { JournalEntry } from "@/lib/store/schema";
import type { Grade } from "./grade";
import type { Attempt, Level, LevelKind } from "./schema";

/**
 * What a kind's interactive component receives.
 *
 * Note `feeds`, not `data`. A component is handed one `ReplayFeed` per slice and
 * cannot reach a bar the player has not been shown — the future lives in a closure
 * inside `createFeed`. Kinds that reveal nothing get a fully-revealed feed, so
 * there is one data channel rather than a rule each kind has to remember.
 *
 * Graders still take full series, on purpose: scoring a prediction or a trade
 * means knowing what happened next.
 */
export type KindProps<K extends LevelKind> = {
  level: Level<K>;
  feeds: ReplayFeed[];
  hintsUsed: number;
  /** Null until the player commits; afterwards the UI is read-only. */
  grade: Grade | null;
  attempt: Attempt[K] | null;
  onCommit: (attempt: Attempt[K]) => void;
  /**
   * Full series — the one intentional hole in the seal, handed only to `composite`.
   *
   * A boss grades each stage as the player finishes it, and grading a
   * `predict-next` stage means knowing what price did next. The composite is
   * engine code rather than a level-facing interaction, so it gets truth
   * explicitly and visibly instead of every kind keeping series "just in case".
   * `seal.test.ts` asserts no other kind receives this.
   */
  truth?: Series<string>[];
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
  /**
   * Bars this kind may reveal past the end of each slice, if any.
   *
   * The feed's window has to be wider than the visible window for a kind that
   * reveals — `classify` extends the chart after committing, `predict-next`
   * animates its horizon — but which kinds do that, and by how much, is the
   * kind's own business. Declaring it here is what lets `LevelPlayer` build feeds
   * without branching on `level.kind`, the rule that keeps ~73 levels from
   * becoming ~73 components.
   *
   * Read from config rather than authored on the slice, so the horizon cannot
   * drift from the number the grader uses.
   */
  revealHorizon?: (level: Level<K>) => number;
  /**
   * Bars visible before the player acts, when that is fewer than the whole slice.
   *
   * Only a replay needs this. A trade level's slice must *contain* its outcome so
   * the grader can score it, which means the initial reveal has to be held back
   * deliberately — otherwise authoring the level hands over the answer.
   */
  primedBars?: (level: Level<K>) => number;
  /**
   * Every journal entry this attempt produced. Empty when the kind writes none.
   *
   * Declared by the kind so `LevelPlayer` never branches on `level.kind` to decide what to
   * persist. Chapter 9 reads the whole record back, so "which kinds write trades" has to be a
   * property of the kinds rather than a growing condition in the player.
   *
   * **Plural, and an array rather than `Draft | null`.** A composite boss produces one entry
   * per replay stage and `trade-sequence` produces ten, so the singular version silently
   * dropped five sixths of the record: a perfect playthrough of Chapters 1-8 logged three
   * trades out of seventeen, and four of the five asset classes never appeared at all. A
   * `Draft | Draft[] | null` union would push a normalisation branch into the dispatcher and
   * into every test; one shape does not.
   *
   * Deliberately **not** given `data`. A composite would then have to re-grade its steps to
   * build the journal — a second grading pass whose only purpose is to be able to disagree
   * with the first. It reads the trade off the grade it was handed instead.
   */
  journalEntries?: (
    attempt: Attempt[K],
    level: Level<K>,
    grade: Grade,
  ) => JournalDraft[];
};

/** A journal entry before the store stamps its id, timestamp and attempt number. */
export type JournalDraft = Omit<JournalEntry, "id" | "at" | "attemptNo">;
