"use client";

import { lazy, type ComponentType } from "react";
import type { KindProps } from "../kind-module";
import type { LevelKind } from "../schema";
import type { ErasedKindProps } from "./erased";

/**
 * The kind components, loaded only when a level actually needs one.
 *
 * The other half of the split described in `behaviour.ts`. This is where the weight is: a kind
 * component reaches charts, overlay canvases, the correlation matrix and the base-rate table,
 * and the registry is imported by `LevelPlayer` on every level route. Statically importing all
 * ten put every kind's UI on every page and left the route at 97% of its budget.
 *
 * Written out literally rather than computed from the kind name. A specifier like
 * ``import(`./${kind}/${Component}`)`` defeats the bundler, which needs something statically
 * analysable to know which chunks to emit — the same reason `LEVEL_LOADERS` is spelled out in
 * `content/index.ts`.
 *
 * `lazy()` runs at module scope but loads nothing until the component renders, so importing
 * this map costs a handful of wrappers. `LevelPlayer` renders inside a `Suspense` boundary; it
 * already had a loading state for the level's own chunk, so there is one more thing arriving
 * late rather than a new kind of waiting.
 *
 * **`composite` is the deliberate exception.** A boss dispatches to several step components, so
 * its chunk carries them — which is correct: those are the components that level needs. What
 * matters is that a non-composite level no longer pays for them.
 */
const KIND_COMPONENTS: { [K in LevelKind]: ComponentType<KindProps<K>> } = {
  annotate: lazy(() =>
    import("./annotate/Annotate").then((m) => ({ default: m.Annotate })),
  ),
  classify: lazy(() =>
    import("./classify/Classify").then((m) => ({ default: m.Classify })),
  ),
  composite: lazy(() =>
    import("./composite/Composite").then((m) => ({ default: m.Composite })),
  ),
  "mark-bars": lazy(() =>
    import("./mark-bars/MarkBars").then((m) => ({ default: m.MarkBars })),
  ),
  "predict-next": lazy(() =>
    import("./predict-next/PredictNext").then((m) => ({ default: m.PredictNext })),
  ),
  "replay-trade": lazy(() =>
    import("./replay-trade/ReplayTrade").then((m) => ({ default: m.ReplayTrade })),
  ),
  "sizing-calc": lazy(() =>
    import("./sizing-calc/SizingCalc").then((m) => ({ default: m.SizingCalc })),
  ),
  "sort-rank": lazy(() =>
    import("./sort-rank/SortRank").then((m) => ({ default: m.SortRank })),
  ),
  "spot-the-flaw": lazy(() =>
    import("./spot-the-flaw/SpotTheFlaw").then((m) => ({ default: m.SpotTheFlaw })),
  ),
  "tune-param": lazy(() =>
    import("./tune-param/TuneParam").then((m) => ({ default: m.TuneParam })),
  ),
};

/**
 * The component for a kind, with its props erased.
 *
 * The map above is typed per kind so a new kind without a component is a compile error. The
 * erasure happens here instead, at one boundary and for the same contravariance reason the
 * graders need it: `KindProps<K>` cannot accept `ErasedKindProps`, because a component
 * reading `level.config` for its own kind cannot be handed any level. `gradeAny` checks the
 * attempt kind at runtime, which is what makes the pairing sound.
 */
export function componentForKind(kind: LevelKind): ComponentType<ErasedKindProps> {
  return KIND_COMPONENTS[kind] as unknown as ComponentType<ErasedKindProps>;
}

/** Test-only: the kinds that have a component registered, for the exhaustiveness guard. */
export function registeredComponentKinds(): LevelKind[] {
  return Object.keys(KIND_COMPONENTS) as LevelKind[];
}
