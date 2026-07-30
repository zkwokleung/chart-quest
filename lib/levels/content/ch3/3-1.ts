import { countTouches, priceTolerance } from "@/lib/chart/geometry";
import type { Level } from "../../schema";

/**
 * SPY-1d 1260-1520 (2010-01-05 to 2011-01-13).
 *
 * Measured: a horizontal band at 112.44 is visited seven separate times across the
 * window, touching 32 bars. That is the most-respected price in the year.
 *
 * The brief deliberately does not claim a single price is *the* answer. Reversals
 * in this window spread across 2.85% of price, so no line can catch them all — what
 * makes this level winnable is its tolerance, which is already a band. Level 3.2
 * makes that band explicit and hands it to the player, and a content-claims test
 * checks the wording here so the two levels cannot end up contradicting each other.
 */
export const level: Level<"annotate"> = {
  id: "3-1",
  chapter: 3,
  title: "A level worth the name",
  kind: "annotate",
  brief:
    "One price mattered more than any other in 2010. Find it — not by the highest high or the lowest low, but by how often price came back to it.",
  data: [{ series: "SPY-1d", from: 1260, to: 1520, label: "SPY · daily" }],
  config: {
    prompt: "Place a horizontal level where price kept returning.",
    shape: "level",
    side: "both",
    requiredTouches: 6,
    expectSlope: "flat",
  },
  target: { reference: { shape: "level", price: 112.44 } },
  tolerance: { priceFracOfRange: 0.02, barSlop: 0 },
  stars: [0.45, 0.7, 0.88],
  misconceptions: [
    {
      id: "level-at-the-extreme",
      test: (attempt, lvl, data) => {
        const drawing = attempt.drawing;
        const series = data[0];
        const slice = lvl.data[0];
        if (!drawing || drawing.shape !== "level" || !series || !slice)
          return false;
        const highs = series.h.slice(slice.from, slice.to);
        const lows = series.l.slice(slice.from, slice.to);
        const high = Math.max(...highs);
        const low = Math.min(...lows);
        const span = high - low;
        // Within a tenth of the window's height of either extreme.
        return (
          drawing.price > high - span * 0.1 || drawing.price < low + span * 0.1
        );
      },
      message:
        "That is the top or the bottom of the year, and price went there once. A level is where price kept coming back, which is almost never the extreme — an extreme is by definition reached one time.",
    },
    {
      id: "level-too-few-touches",
      test: (attempt, lvl, data) => {
        const drawing = attempt.drawing;
        const series = data[0];
        const slice = lvl.data[0];
        if (!drawing || !series || !slice) return false;
        const window = { from: slice.from, to: slice.to };
        const tol = priceTolerance(series, window, lvl.tolerance);
        return (
          countTouches(drawing, series, window, tol, lvl.config.side).length < 6
        );
      },
      message:
        "Price barely visited that price. Look for the height the chart keeps returning to from both sides — there is one here that catches more than thirty bars across seven separate visits.",
    },
  ],
  unlocks: ["measure"],
  hints: [
    "Ignore the extremes and look for the height price keeps crossing.",
    "It is in the low 110s, and price came back to it seven times.",
  ],
};
