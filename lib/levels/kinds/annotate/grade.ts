import {
  anchorQuality,
  anchorsOf,
  countBodyCuts,
  countTouches,
  priceTolerance,
  slopeOf,
  type Drawing,
} from "@/lib/chart/geometry";
import type { Series } from "@/lib/chart/types";
import { diagnose, starsFor, type Grade } from "../../grade";
import type { Attempt, Level } from "../../schema";

/**
 * Scores the line the player drew, on its own merits.
 *
 * The authored reference is shown as the correction and used by `perfectAttempt`,
 * but never to score. Measured reason: BTC-1d alone contains 182 lines with three
 * or more touches and zero body cuts, EURUSD 498. A trendline is genuinely not
 * unique, so scoring by proximity to one author's line would mark most correct
 * answers wrong and teach guessing the author instead of reading the chart.
 */

/** Weights across the scored components. Slope is a gate, not a component. */
const WEIGHTS = { touches: 0.5, cuts: 0.35, anchors: 0.15 };

export type AnnotateBreakdown = {
  touches: number;
  cuts: number;
  anchorsOnWick: number;
  anchorCount: number;
  slopeOk: boolean;
};

/**
 * The span the player actually asserted.
 *
 * Beyond their anchors a line is a projection, and neither credit nor blame
 * applies there: a bar closing through a projected line is an invalidation, not a
 * drawing error. Measuring across the whole window instead made the researched
 * reference line for level 2.3 register a body cut 20 bars past its own end.
 *
 * Shapes without anchors (a level, a zone) apply to the whole window by nature.
 */
export function drawnSpan(
  drawing: Drawing,
  slice: { from: number; to: number },
): { from: number; to: number } {
  const anchors = anchorsOf(drawing);
  if (anchors.length === 0) return { from: slice.from, to: slice.to };
  const bars = anchors.map((a) => a.bar);
  return {
    from: Math.max(slice.from, Math.min(...bars)),
    to: Math.min(slice.to, Math.max(...bars) + 1),
  };
}

export function measure(
  drawing: Drawing,
  level: Level<"annotate">,
  data: Series<string>[],
): AnnotateBreakdown | null {
  const series = data[0];
  const slice = level.data[0];
  if (!series || !slice) return null;

  // Tolerance from the level's own window; counting only across the span the
  // player drew. Two different ranges, deliberately.
  const window = { from: slice.from, to: slice.to };
  const tol = priceTolerance(series, window, level.tolerance);
  const range = drawnSpan(drawing, slice);
  const { side, expectSlope } = level.config;

  const touched = countTouches(drawing, series, range, tol, side);
  const cuts = countBodyCuts(drawing, series, range, tol);

  const anchors = anchorsOf(drawing);
  const onWick = anchors.filter((a) => anchorQuality(a, series, tol) === "wick").length;

  const slope = slopeOf(drawing);
  const slopeOk =
    expectSlope === undefined ||
    (expectSlope === "up" && slope > 0) ||
    (expectSlope === "down" && slope < 0) ||
    (expectSlope === "flat" && slope === 0);

  return {
    touches: touched.length,
    cuts: cuts.length,
    anchorsOnWick: onWick,
    anchorCount: anchors.length,
    slopeOk,
  };
}

export function gradeAnnotate(
  attempt: Attempt["annotate"],
  level: Level<"annotate">,
  data: Series<string>[],
): Grade {
  const series = data[0];
  const slice = level.data[0];
  const reference = level.target.reference;

  const emptyOverlay = {
    kind: "drawing" as const,
    drawn: attempt.drawing,
    reference,
    touched: [] as number[],
    cuts: [] as number[],
  };

  if (!attempt.drawing || !series || !slice) {
    return {
      score: 0,
      stars: 0,
      diagnosis: diagnose(attempt, level, data),
      reference: emptyOverlay,
    };
  }

  const drawing = attempt.drawing;
  const stats = measure(drawing, level, data);
  const span = drawnSpan(drawing, slice);
  const tol = priceTolerance(
    series,
    { from: slice.from, to: slice.to },
    level.tolerance,
  );
  const touched = countTouches(drawing, series, span, tol, level.config.side);
  const cuts = countBodyCuts(drawing, series, span, tol);

  const overlay = {
    kind: "drawing" as const,
    drawn: drawing,
    reference,
    touched,
    cuts,
  };

  if (!stats) {
    return { score: 0, stars: 0, diagnosis: diagnose(attempt, level, data), reference: overlay };
  }

  // A support line sloping downwards is not a badly-drawn support line, it is a
  // different object. Partial credit would suggest otherwise, so this zeroes and
  // lets the diagnosis do the teaching.
  if (!stats.slopeOk) {
    return {
      score: 0,
      stars: 0,
      diagnosis: diagnose(attempt, level, data),
      reference: overlay,
      detail: { slope: "wrong direction" },
    };
  }

  // A line neither touching price nor cutting through it is a line about nothing.
  // Without this gate, drawing far from the chart scored on "zero body cuts" —
  // absence of a fault earning credit.
  //
  // The `cuts === 0` half matters pedagogically: a line drawn through the middle of
  // the bodies also has no support touches, but it is emphatically near price. It
  // falls through to normal scoring so the score card and diagnosis name
  // body-cutting, which is the useful lesson, rather than "never reaches price".
  if (stats.touches === 0 && stats.cuts === 0) {
    return {
      score: 0,
      stars: 0,
      diagnosis: diagnose(attempt, level, data),
      reference: overlay,
      detail: { touches: "0 — the line never reaches price" },
    };
  }

  const required = Math.max(2, level.config.requiredTouches);
  const touchScore = Math.max(0, Math.min(1, (stats.touches - 1) / (required - 1)));
  const cutScore = stats.cuts === 0 ? 1 : Math.max(0, 1 - 0.34 * stats.cuts);
  const anchorScore =
    stats.anchorCount === 0 ? 1 : stats.anchorsOnWick / stats.anchorCount;

  const score = Math.max(
    0,
    Math.min(
      1,
      touchScore * WEIGHTS.touches +
        cutScore * WEIGHTS.cuts +
        anchorScore * WEIGHTS.anchors,
    ),
  );

  return {
    score,
    stars: starsFor(score, level.stars, attempt.hintsUsed),
    diagnosis: diagnose(attempt, level, data),
    reference: overlay,
    detail: {
      touches: `${stats.touches} of ${required} needed`,
      "body cuts": stats.cuts,
      anchors: `${stats.anchorsOnWick} of ${stats.anchorCount} on a wick`,
    },
  };
}

export function perfectAnnotate(level: Level<"annotate">): Attempt["annotate"] {
  return { kind: "annotate", drawing: level.target.reference, hintsUsed: 0 };
}
