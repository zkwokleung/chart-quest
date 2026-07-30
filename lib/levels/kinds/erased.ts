import type { Series } from "@/lib/chart/types";
import type { ReplayFeed } from "@/lib/replay/feed";
import type { Grade } from "../grade";
import type { AnyLevel, Attempt, LevelKind } from "../schema";

/**
 * A kind component's props with its kind erased.
 *
 * `Level<K>` is not assignable to `Level<LevelKind>` because a misconception's
 * `test` accepts that kind's attempt and function parameters are contravariant, so
 * erasure at a dispatch boundary is unavoidable.
 *
 * Lives in its own module rather than the registry so the composite can dispatch
 * to step components without importing the registry that imports it.
 */
export type ErasedKindProps = {
  level: AnyLevel;
  feeds: ReplayFeed[];
  hintsUsed: number;
  grade: Grade | null;
  attempt: Attempt[LevelKind] | null;
  onCommit: (attempt: Attempt[LevelKind]) => void;
  /** See `KindProps.truth` — composite only, and asserted so in seal.test.ts. */
  truth?: Series<string>[];
};
