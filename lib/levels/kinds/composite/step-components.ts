import { createElement, type ComponentType, type ReactElement } from "react";
import type { ReplayFeed } from "@/lib/replay/feed";
import type { Grade } from "../../grade";
import type { AnyStep, Level, StepAttempt, StepKind } from "../../schema";
import type { ErasedKindProps } from "../erased";
import { Annotate } from "../annotate/Annotate";
import { Classify } from "../classify/Classify";
import { MarkBars } from "../mark-bars/MarkBars";
import { PredictNext } from "../predict-next/PredictNext";
import { ReplayTrade } from "../replay-trade/ReplayTrade";
import { SortRank } from "../sort-rank/SortRank";
import { SizingCalc } from "../sizing-calc/SizingCalc";
import { SpotTheFlaw } from "../spot-the-flaw/SpotTheFlaw";
import { TuneParam } from "../tune-param/TuneParam";

/**
 * Step components, imported directly for the same reason as their graders: the
 * kind registry imports the composite, so going back through it would cycle.
 */
const COMPONENTS = {
  annotate: Annotate,
  classify: Classify,
  "mark-bars": MarkBars,
  "predict-next": PredictNext,
  "replay-trade": ReplayTrade,
  "sort-rank": SortRank,
  "sizing-calc": SizingCalc,
  "spot-the-flaw": SpotTheFlaw,
  "tune-param": TuneParam,
} as const;

export function componentForStep(
  kind: StepKind,
): ComponentType<ErasedKindProps> {
  return COMPONENTS[kind] as unknown as ComponentType<ErasedKindProps>;
}

export type StepProps = {
  level: Level<StepKind>;
  feeds: ReplayFeed[];
  hintsUsed: number;
  grade: Grade | null;
  attempt: StepAttempt | null;
  onCommit: (attempt: StepAttempt) => void;
};

/**
 * Bars a step may reveal past its slice.
 *
 * The registry's `revealHorizonFor` cannot be used here — it imports the
 * composite, so reaching back through it would cycle, the same reason the step
 * graders and components are imported directly. Small enough to state twice; the
 * numbers come from the same config fields either way.
 */
export function stepRevealHorizon(step: AnyStep): number {
  if (step.kind === "predict-next") return step.config.horizon;
  if (step.kind === "classify") return step.config.revealBars ?? 0;
  return 0;
}

/**
 * Bars a stage starts with visible, or undefined for its whole slice.
 *
 * Only a trade stage holds anything back — its slice contains the outcome the
 * grader needs, so showing all of it up front would hand over the answer. Boss 4.B
 * onwards depends on this.
 */
export function stepPrimedBars(step: AnyStep): number | undefined {
  return step.kind === "replay-trade" ? step.config.primeBars : undefined;
}

/**
 * Renders one step through its kind's component.
 *
 * The cast lives here with the rest of the erasure. `Level<StepKind>` is not
 * assignable to `AnyLevel` because a misconception's `test` accepts that kind's
 * attempt and function parameters are contravariant — the same reason the kind
 * registry erases. Confining it to one helper keeps the composite's own code
 * type-safe.
 */
export function renderStep(kind: StepKind, props: StepProps): ReactElement {
  return createElement(
    componentForStep(kind),
    props as unknown as ErasedKindProps,
  );
}
