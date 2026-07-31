import { priceTolerance } from "@/lib/chart/geometry";
import { countRespect } from "../../kinds/annotate/grade";
import type { Level } from "../../schema";

/**
 * SPY-1d 1260-1520 (2010-01-05 to 2011-01-13).
 *
 * Measured: **117.75 is where price actually turned**, catching 8 of the window's 44
 * swing reversals inside the level's tolerance. The same line lifted 40% of the
 * window's range catches none, so the answer is sharp.
 *
 * The first version of this level used 112.44, the price with the most *bar touches*
 * — 32 bars across seven visits. That turned out to be a price price spent time at
 * rather than one it reversed at: it catches 2 reversals. Worse, the level still
 * scored three stars with its line lifted 40% of the range, because in a wide window
 * almost any price is touched by plenty of bars. The perturbation sweep caught it,
 * and the grader now counts reversals rather than touches for horizontal shapes.
 *
 * The brief still does not claim a single price is *the* answer. Reversals here
 * spread across 2.85% of price, so no line catches them all — what makes this level
 * winnable is its tolerance, which is already a band, and 3.2 is where that band
 * becomes explicit and player-owned.
 */
export const level: Level<"annotate"> = {
  id: "3-1",
  chapter: 3,
  title: "A level worth the name",
  kind: "annotate",
  brief:
    "One price mattered more than any other in 2010. Find it — not by the highest high or the lowest low, but by how often price turned around there.",
  data: [{ series: "SPY-1d", from: 1260, to: 1520, label: "SPY · daily" }],
  config: {
    prompt: "Place a horizontal level where price kept returning.",
    shape: "level",
    side: "both",
    requiredTouches: 6,
    expectSlope: "flat",
  },
  target: { reference: { shape: "level", price: 117.75 } },
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
        // The same helper the score uses, so the marks and the explanation cannot
        // drift apart — the mistake 2.3 made in M4.
        return (
          countRespect(drawing, series, window, tol, lvl.config.side).length < 6
        );
      },
      message:
        "Price passed through there without turning. A level is a price the market *reversed* at, not one it spent time near — there is a height in this window where eight separate swings stopped and turned around.",
    },
  ],
  unlocks: ["measure"],
  hints: [
    "Ignore the extremes and look for the height where swings keep ending.",
    "It is in the high 110s, and eight separate reversals happened there.",
  ],
};
