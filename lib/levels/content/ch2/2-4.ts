import type { Level } from "../../schema";

/**
 * The same window as 2.3, from above.
 *
 * A channel was planned here and the data does not contain one: measured against
 * the support line of 2.3, no parallel offset catches a single high — the highs
 * *fall* while the lows rise. That makes this a contracting triangle, and the
 * falling resistance line is the half worth drawing, because the two lines
 * together explain the breakout that followed.
 */
export const level: Level<"annotate"> = {
  id: "2-4",
  chapter: 2,
  title: "The other side",
  kind: "annotate",
  brief:
    "You drew the rising floor. Now draw the ceiling — and notice it is not parallel.",
  data: [{ series: "BTCUSDT-1d", from: 1000, to: 1090, label: "BTCUSDT · daily" }],
  config: {
    prompt:
      "Draw a falling resistance line across the highs. Together with the line you drew before, it forms a shape that squeezes.",
    shape: "trendline",
    side: "resistance",
    requiredTouches: 3,
    expectSlope: "down",
  },
  target: {
    // Measured, not guessed: of every falling line through two swing highs in this
    // window, this pair is the only one with a double-digit touch count and zero
    // body cuts (11 and 0). The steeper line from the 18 May high scores 18 touches
    // but cuts five bodies, so it reads worse by the grader's own measure.
    reference: {
      shape: "trendline",
      a: { bar: 1028, price: 9992.72 },
      b: { bar: 1060, price: 9345 },
    },
  },
  tolerance: { priceFracOfRange: 0.02, barSlop: 1 },
  stars: [0.4, 0.7, 0.9],
  misconceptions: [
    {
      id: "drew-a-parallel",
      test: (attempt) => {
        const d = attempt.drawing;
        if (!d || d.shape !== "trendline" || d.b.bar === d.a.bar) return false;
        return (d.b.price - d.a.price) / (d.b.bar - d.a.bar) > 0;
      },
      message:
        "That line rises, so you have drawn a channel — two parallel rails. The highs here are falling while the lows rise: the shape contracts rather than running straight, which is why the eventual break was so sharp.",
    },
    {
      id: "used-the-lows",
      test: (attempt, level, data) => {
        const d = attempt.drawing;
        if (!d || d.shape !== "trendline") return false;
        const series = data[0];
        if (!series) return false;
        // Anchored nearer the lows than the highs.
        return [d.a, d.b].every((anchor) => {
          const h = series.h[anchor.bar];
          const l = series.l[anchor.bar];
          if (h === undefined || l === undefined) return false;
          return Math.abs(anchor.price - l) < Math.abs(anchor.price - h);
        });
      },
      message:
        "A resistance line is drawn across the highs, not the lows. Sellers show up at the top of a bar — that is the price to connect.",
    },
  ],
  hints: [
    "Resistance connects highs. Start at the high around 9,993 in mid-June.",
    "The second is a lower high in mid-July, near 9,345.",
  ],
};
