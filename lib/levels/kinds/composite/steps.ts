import type { AnyStep, CompositeStep, Level, StepKind } from "../../schema";

/**
 * Turns a step into a real `Level`.
 *
 * This is what makes a composite boss reuse the whole engine: given a synthesised
 * level, the existing kind component renders the step and the existing grader
 * scores it, with no branch anywhere for "is this inside a boss".
 *
 * The synthesised level borrows the composite's id so anything logging or keying on
 * it stays consistent, and carries fixed per-step thresholds — a step's own star
 * rating is only ever shown as progress; the boss's stars come from the weighted
 * score in `grade.ts`.
 */
const STEP_THRESHOLDS: [number, number, number] = [0.4, 0.7, 0.9];

export function stepAsLevel<K extends StepKind>(
  composite: Level<"composite">,
  step: CompositeStep<K>,
): Level<K> {
  return {
    id: composite.id,
    chapter: composite.chapter,
    title: composite.title,
    kind: step.kind,
    brief: step.brief,
    data: step.data ?? composite.data,
    // The boss's axis mode carries to its stages. Dropping it was silent: `yAxisFor` resolved
    // `mode: undefined`, the chart fell back to the player's stored preference, and 8.B opened
    // on a price axis while its first stage asks how big a typical day is *as a share of
    // price*. The y-axis unit tests caught the visibility rule; only a browser caught this.
    yAxis: composite.yAxis,
    config: step.config,
    target: step.target,
    tolerance: step.tolerance,
    stars: STEP_THRESHOLDS,
    misconceptions: step.misconceptions,
    // Hints belong to the boss as a whole, not to one of its stages.
    hints: [],
  };
}

/** Erased form, for walking steps whose kinds are not known statically. */
export function stepAsAnyLevel(
  composite: Level<"composite">,
  step: AnyStep,
): Level<StepKind> {
  return stepAsLevel(composite, step as CompositeStep<StepKind>);
}

/**
 * Normalised weights.
 *
 * Authors write weights that should sum to 1 and a guard checks it, but scoring
 * divides by the actual total so a rounding slip cannot silently deflate a boss's
 * score.
 */
export function weightsOf(steps: AnyStep[]): number[] {
  const total = steps.reduce((sum, s) => sum + s.weight, 0);
  if (total <= 0) return steps.map(() => 1 / Math.max(1, steps.length));
  return steps.map((s) => s.weight / total);
}
