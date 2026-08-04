import type { Series } from "@/lib/chart/types";
import type { Grade } from "../grade";
import type { JournalDraft } from "../kind-module";
import type { AnyLevel, Attempt, Level, LevelKind } from "../schema";
import { gradeAnnotate, perfectAnnotate } from "./annotate/grade";
import { gradeClassify, perfectClassify, revealHorizonClassify } from "./classify/grade";
import {
  gradeComposite,
  journalEntriesComposite,
  perfectComposite,
} from "./composite/grade";
import { gradeMarkBars, perfectMarkBars } from "./mark-bars/grade";
import {
  gradePredictNext,
  perfectPredictNext,
  revealHorizonPredictNext,
} from "./predict-next/grade";
import {
  gradeReplayTrade,
  journalEntriesReplayTrade,
  perfectReplayTrade,
  primedBarsReplayTrade,
} from "./replay-trade/grade";
import { gradeSizingCalc, perfectSizingCalc } from "./sizing-calc/grade";
import { gradeSortRank, perfectSortRank } from "./sort-rank/grade";
import { gradeSpotTheFlaw, perfectSpotTheFlaw } from "./spot-the-flaw/grade";
import {
  gradeTradeSequence,
  journalEntriesTradeSequence,
  perfectTradeSequence,
} from "./trade-sequence/grade";
import { gradeBuildRules, perfectBuildRules } from "./build-rules/grade";
import { gradeProbe, perfectProbe } from "./probe/grade";
import { gradeTuneParam, perfectTuneParam } from "./tune-param/grade";

/**
 * Everything about a kind that is *not* a component.
 *
 * Split from the components deliberately, and the reason is measured: the registry is reached
 * from `LevelPlayer`, a client module on every level route, so anything it imports eagerly
 * ships to every level. With ten kinds statically imported, a `classify` level was shipping
 * `ReplayTrade`, `SortRank`, `SizingCalc`, the correlation matrix and the base-rate table —
 * and the route sat at 97% of its budget with three chapters left to build.
 *
 * This half is imported eagerly on purpose. Graders are pure, small, and needed by the
 * authoring guards, the seal test and the y-axis-invariance test — all of which run over every
 * authored level at once, so lazy-loading them would buy nothing and cost a great deal of
 * plumbing. **Nothing in this file may import a component**, which is why the reveal, prime
 * and journal helpers live beside their graders rather than in a per-kind index.
 *
 * `components.ts` holds the other half.
 */

export type KindBehaviour<K extends LevelKind> = {
  kind: K;
  grade: (
    attempt: Attempt[K],
    level: Level<K>,
    data: Series<string>[],
  ) => Grade;
  perfectAttempt: (level: Level<K>, data: Series<string>[]) => Attempt[K];
  /** Bars this kind may reveal past the end of each slice, if any. */
  revealHorizon?: (level: Level<K>) => number;
  /** Bars visible before the player acts, when fewer than the whole slice. */
  primedBars?: (level: Level<K>) => number;
  /**
   * Every journal entry this attempt produced, empty when the kind writes none.
   *
   * Plural because a composite boss produces one per replay stage and a sequence produces ten.
   * The singular version silently dropped five sixths of the record — see `kind-module.ts`.
   */
  journalEntries?: (
    attempt: Attempt[K],
    level: Level<K>,
    grade: Grade,
  ) => JournalDraft[];
};

/**
 * Annotated rather than `satisfies`, deliberately.
 *
 * `satisfies` would keep each entry's literal type, so a kind that declares no
 * `revealHorizon` would not have the property *at all* — and the erased lookups below could
 * not ask for it. A mapped-type annotation still fails on a missing kind, which is the
 * exhaustiveness this needs, while giving every entry the optional members.
 */
export const KIND_BEHAVIOUR: { [K in LevelKind]: KindBehaviour<K> } = {
  annotate: {
    kind: "annotate",
    grade: gradeAnnotate,
    perfectAttempt: perfectAnnotate,
  },
  classify: {
    kind: "classify",
    grade: gradeClassify,
    perfectAttempt: perfectClassify,
    revealHorizon: revealHorizonClassify,
  },
  composite: {
    kind: "composite",
    grade: gradeComposite,
    perfectAttempt: perfectComposite,
    journalEntries: journalEntriesComposite,
  },
  "mark-bars": {
    kind: "mark-bars",
    grade: gradeMarkBars,
    perfectAttempt: perfectMarkBars,
  },
  "predict-next": {
    kind: "predict-next",
    grade: gradePredictNext,
    perfectAttempt: perfectPredictNext,
    revealHorizon: revealHorizonPredictNext,
  },
  "replay-trade": {
    kind: "replay-trade",
    grade: gradeReplayTrade,
    perfectAttempt: perfectReplayTrade,
    primedBars: primedBarsReplayTrade,
    journalEntries: journalEntriesReplayTrade,
  },
  "sizing-calc": {
    kind: "sizing-calc",
    grade: gradeSizingCalc,
    perfectAttempt: perfectSizingCalc,
  },
  "sort-rank": {
    kind: "sort-rank",
    grade: gradeSortRank,
    perfectAttempt: perfectSortRank,
  },
  "spot-the-flaw": {
    kind: "spot-the-flaw",
    grade: gradeSpotTheFlaw,
    perfectAttempt: perfectSpotTheFlaw,
  },
  "trade-sequence": {
    kind: "trade-sequence",
    grade: gradeTradeSequence,
    perfectAttempt: perfectTradeSequence,
    journalEntries: journalEntriesTradeSequence,
  },
  probe: {
    kind: "probe",
    grade: gradeProbe,
    perfectAttempt: perfectProbe,
  },
  "build-rules": {
    kind: "build-rules",
    grade: gradeBuildRules,
    perfectAttempt: perfectBuildRules,
  },
  "tune-param": {
    kind: "tune-param",
    grade: gradeTuneParam,
    perfectAttempt: perfectTuneParam,
  },
};

/** Any level, with its kind erased at the dispatch boundary. See `kinds/index.ts`. */
export type ErasedLevel = AnyLevel;
