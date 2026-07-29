import { anchorQuality, anchorsOf, priceTolerance } from "@/lib/chart/geometry";
import type { Level } from "../../schema";

/**
 * BTCUSDT-1d 1000-1090 (2020-05-13 to 2020-08-10).
 *
 * The support line through the lows of bars 1012 (8642.72) and 1058 (9125) has 14
 * touches and zero body cuts by the grader's own measure.
 *
 * Deliberately NOT described as an uptrend. Measured with `readStructure`, this
 * window is a range: its swing highs run 9950 → 10380 → 9993 → 9589 → 9292, only
 * 63% rising. The floor rises while the ceiling does not — which is exactly why
 * the support line is worth drawing here.
 */
export const level: Level<"annotate"> = {
  id: "2-3",
  chapter: 2,
  title: "Draw the trendline",
  kind: "annotate",
  brief:
    "Through the summer of 2020 Bitcoin went nowhere in particular, but its floor kept lifting. Find the line the sellers kept failing to break.",
  data: [{ series: "BTCUSDT-1d", from: 1000, to: 1090, label: "BTCUSDT · daily" }],
  config: {
    prompt:
      "Draw a rising support line under the lows. Anchor it to wicks, not bodies — a line through a body means price traded on both sides of it.",
    shape: "trendline",
    side: "support",
    requiredTouches: 3,
    expectSlope: "up",
  },
  target: {
    reference: {
      shape: "trendline",
      a: { bar: 1012, price: 8642.72 },
      b: { bar: 1058, price: 9125 },
    },
  },
  tolerance: { priceFracOfRange: 0.02, barSlop: 1 },
  stars: [0.4, 0.7, 0.9],
  misconceptions: [
    {
      id: "not-anchored-to-wicks",
      // Uses the same helper the score uses, so the explanation and the marks can
      // never disagree. An earlier version tested only for anchors strictly inside a
      // body, which left a player docked 15% with nothing said about why.
      test: (attempt, level, data) => {
        const drawing = attempt.drawing;
        const series = data[0];
        const slice = level.data[0];
        if (!drawing || !series || !slice) return false;
        const tol = priceTolerance(
          series,
          { from: slice.from, to: slice.to },
          level.tolerance,
        );
        return anchorsOf(drawing).some(
          (anchor) => anchorQuality(anchor, series, tol) !== "wick",
        );
      },
      message:
        "Your line is not anchored to the wicks. Put each end on a low — that is where sellers actually gave up. Resting an anchor above the low leaves the line floating in space, or cutting a body price traded on both sides of.",
    },
    {
      id: "sloping-down",
      test: (attempt) => {
        const d = attempt.drawing;
        if (!d || d.shape !== "trendline") return false;
        return d.b.bar !== d.a.bar && (d.b.price - d.a.price) / (d.b.bar - d.a.bar) <= 0;
      },
      message:
        "That line falls. The lows in this window are rising, so a support line under them has to rise too — a falling line is describing a different market.",
    },
    {
      id: "too-few-touches",
      test: (attempt, level, data) => {
        const d = attempt.drawing;
        if (!d || d.shape !== "trendline") return false;
        const series = data[0];
        if (!series) return false;
        return Math.abs(d.b.bar - d.a.bar) < 15;
      },
      message:
        "Your line spans only a few bars. Any two points make a line — a trendline has to survive a stretch of chart before it means anything, so reach for lows further apart.",
    },
  ],
  hints: [
    "Start at the lowest low in the first third of the window.",
    "The second anchor is another low roughly six weeks later, around 9,125.",
  ],
};
