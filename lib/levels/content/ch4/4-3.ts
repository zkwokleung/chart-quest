import type { Level } from "../../schema";

/**
 * AAPL-1d 4411-4466 (2022-07-13 to 2022-09-29), the falling ceiling of a bear flag.
 *
 * Four swing highs sit on one descending line, and none of them is more than 1.3% of
 * the window's height away from it:
 *
 *   4436  176.15   (2022-08-16)
 *   4443  171.05
 *   4453  164.26
 *   4460  158.74   (2022-09-15)
 *
 * The line drops 9.9% across those twenty-four bars, and price fell a further 6.4%
 * in the twenty bars after the last touch — so this one continued, which is what a
 * continuation pattern is supposed to do.
 *
 * **That it continued was a search criterion, and it should be admitted.** The first
 * window found this way was AAPL 750-805, a cleaner line with five touches — and
 * price broke *up* through it and was 22.7% higher twenty bars later. Both are real
 * bear flags; only one behaved. Picking the one that behaved makes this a level about
 * drawing a boundary rather than a claim that boundaries hold, and 4.6 is where a
 * textbook pattern is allowed to fail on camera.
 *
 * **A trendline, not a channel.** The curriculum says "draw the boundaries", plural.
 * `Drawing` has a `channel` shape, but the annotate grader scores its primary rail
 * only — the offset rail is drawn and not measured — so asking for a channel would
 * grade half of what it asked for. The falling ceiling is the half that carries the
 * information anyway; a bear flag's floor is a horizontal level, which is Chapter 3.
 */
export const level: Level<"annotate"> = {
  id: "4-3",
  chapter: 4,
  title: "The ceiling on the way down",
  kind: "annotate",
  brief:
    "Apple through the summer of 2022. After each bounce, sellers came back a little lower than the time before — four times, in a straight line. Draw the line they came back at.",
  data: [{ series: "AAPL-1d", from: 4411, to: 4466, label: "AAPL · daily" }],
  config: {
    prompt: "Draw the descending line the rallies kept stopping at.",
    shape: "trendline",
    side: "resistance",
    requiredTouches: 4,
    expectSlope: "down",
  },
  target: {
    reference: {
      shape: "trendline",
      a: { bar: 4436, price: 176.15 },
      b: { bar: 4460, price: 158.74 },
    },
  },
  tolerance: { priceFracOfRange: 0.03, barSlop: 2 },
  stars: [0.45, 0.7, 0.88],
  misconceptions: [
    {
      id: "flag-drew-it-flat",
      test: (attempt) => {
        const drawing = attempt.drawing;
        if (!drawing || drawing.shape !== "trendline") return false;
        const bars = drawing.b.bar - drawing.a.bar;
        if (bars === 0) return false;
        const slope = (drawing.b.price - drawing.a.price) / bars;
        // Less than a third of the reference's descent counts as flat here.
        return slope > -0.24;
      },
      message:
        "A horizontal line misses what this window is telling you. Each rally stopped lower than the last — that is the whole difference between a range, where sellers keep appearing at one price, and a downtrend, where they keep appearing sooner.",
    },
    {
      id: "flag-drew-the-floor",
      test: (attempt, lvl, data) => {
        const drawing = attempt.drawing;
        const series = data[0];
        const slice = lvl.data[0];
        if (!drawing || drawing.shape !== "trendline" || !series || !slice) {
          return false;
        }
        const highs = series.h.slice(slice.from, slice.to);
        const lows = series.l.slice(slice.from, slice.to);
        const high = Math.max(...highs);
        const low = Math.min(...lows);
        const mid = low + (high - low) / 2;
        return drawing.a.price < mid && drawing.b.price < mid;
      },
      message:
        "That is the underside of the move. The question asked where the rallies *stopped*, which is a ceiling — and in a falling market the ceiling is the side that keeps getting broken, so it is the side worth knowing.",
    },
    {
      id: "flag-two-points-only",
      test: (attempt, lvl, data) => {
        const drawing = attempt.drawing;
        const series = data[0];
        const slice = lvl.data[0];
        if (!drawing || drawing.shape !== "trendline" || !series || !slice) {
          return false;
        }
        // A line spanning less than a third of the window cannot have four touches.
        const span = Math.abs(drawing.b.bar - drawing.a.bar);
        return span < (slice.to - slice.from) / 3;
      },
      message:
        "Your line is too short to have been tested. Any two points make a line; what makes one worth drawing is a third and fourth point arriving at it later, which is why this window was chosen for having four.",
    },
  ],
  hints: [
    "Start at the highest point of the consolidation and connect it to the last lower high.",
    "Four rallies stopped on this line. If yours only touches two, it is describing less than it could.",
  ],
};
