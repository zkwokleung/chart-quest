import { createElement, type ComponentType, type ReactElement } from "react";
import type { Series } from "@/lib/chart/types";
import type { Grade } from "../../grade";
import type { Level, StepAttempt, StepKind } from "../../schema";
import type { ErasedKindProps } from "../erased";
import { Annotate } from "../annotate/Annotate";
import { Classify } from "../classify/Classify";
import { MarkBars } from "../mark-bars/MarkBars";
import { PredictNext } from "../predict-next/PredictNext";

/**
 * Step components, imported directly for the same reason as their graders: the
 * kind registry imports the composite, so going back through it would cycle.
 */
const COMPONENTS = {
  annotate: Annotate,
  classify: Classify,
  "mark-bars": MarkBars,
  "predict-next": PredictNext,
} as const;

export function componentForStep(kind: StepKind): ComponentType<ErasedKindProps> {
  return COMPONENTS[kind] as unknown as ComponentType<ErasedKindProps>;
}

export type StepProps = {
  level: Level<StepKind>;
  data: Series<string>[];
  hintsUsed: number;
  grade: Grade | null;
  attempt: StepAttempt | null;
  onCommit: (attempt: StepAttempt) => void;
};

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
