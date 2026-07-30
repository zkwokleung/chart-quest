import type { Level } from "../../schema";

/**
 * SPY-1d 3340-3600 (2018-04-11 to 2019-04-24).
 *
 * The chapter's pivot, and the measurement behind it nearly went wrong twice.
 *
 * Counting *visits*, a thin line beat a 1.5% zone in three of four windows tested —
 * which appears to refute the whole premise. It does not: widening a band merges
 * adjacent touches into single visits, so the visit count mechanically falls as the
 * band grows. The metric was wrong, not the lesson.
 *
 * Measured as **reversal-price dispersion**, the lesson is emphatic. A 1.5% zone
 * around 282.51 catches **12 swing reversals spread over 2.67% of price**, and the
 * best thin line — 0.2% wide — can catch at most **4** of them. Price did not turn at
 * a price. It turned in a band, twelve times.
 *
 * The first draft of this level put the zone at 264.65, which is the optimum by
 * *visit count* rather than by reversals caught — two different maxima in the same
 * window, and the 12-reversal claim belonged to the other one. The content-claims
 * test caught the mismatch.
 */
export const level: Level<"annotate"> = {
  id: "3-2",
  chapter: 3,
  title: "A line is too thin",
  kind: "annotate",
  brief:
    "Price turned twelve times in this stretch, and never twice at the same price. Draw the band it actually turned in.",
  data: [{ series: "SPY-1d", from: 3340, to: 3600, label: "SPY · daily" }],
  config: {
    prompt: "Drag out a zone covering where price kept reversing.",
    shape: "zone",
    side: "both",
    requiredTouches: 8,
    expectSlope: "flat",
  },
  target: { reference: { shape: "zone", top: 286.74, bottom: 278.27 } },
  tolerance: { priceFracOfRange: 0.02, barSlop: 0 },
  stars: [0.45, 0.7, 0.88],
  misconceptions: [
    {
      id: "zone-too-thin",
      test: (attempt) => {
        const drawing = attempt.drawing;
        if (!drawing || drawing.shape !== "zone") return false;
        const mid = (drawing.top + drawing.bottom) / 2;
        if (mid <= 0) return false;
        return (drawing.top - drawing.bottom) / mid < 0.01;
      },
      message:
        "That is a line wearing a zone's clothes. The reversals here are spread across nearly 3% of price, so a band under 1% wide can only ever catch a third of them — which is exactly the problem this level exists to show.",
    },
    {
      id: "zone-swallows-the-chart",
      test: (attempt, lvl, data) => {
        const drawing = attempt.drawing;
        const series = data[0];
        const slice = lvl.data[0];
        if (!drawing || drawing.shape !== "zone" || !series || !slice)
          return false;
        const high = Math.max(...series.h.slice(slice.from, slice.to));
        const low = Math.min(...series.l.slice(slice.from, slice.to));
        const span = high - low;
        if (span <= 0) return false;
        return (drawing.top - drawing.bottom) / span > 0.5;
      },
      message:
        "A zone covering half the chart is not a zone, it is a shrug. It will contain every reversal and tell you nothing about any of them — a level has to exclude most of the chart to be worth drawing.",
    },
  ],
  hints: [
    "Look for the height price keeps returning to, then widen it until it covers the turns rather than one of them.",
    "The turns cluster in the low-to-mid 280s.",
  ],
};
