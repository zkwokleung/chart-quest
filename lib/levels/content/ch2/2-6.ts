import type { Level } from "../../schema";

/**
 * BTCUSDT-1d 180-250 (2018-02-13 to 2018-04-23), the post-bubble consolidation.
 *
 * The window's extremes are 11,786 and 6,430, but bounds drawn exactly there catch
 * only two touches each — an extreme is by definition reached once. Insetting by 3%
 * of the range gives 11,625 and 6,591, which price tests nine times between them.
 * That is what a range's edges actually are: where price repeatedly turned, not the
 * single furthest point it reached.
 *
 * Net drift across the window is 7% of its own height, so this really is a range
 * rather than a trend that happens to be wide.
 */
export const level: Level<"annotate"> = {
  id: "2-6",
  chapter: 2,
  title: "Bound the range",
  kind: "annotate",
  brief:
    "After the 2018 crash Bitcoin spent ten weeks going nowhere — ending within a few percent of where it started, having covered that distance many times over.",
  data: [{ series: "BTCUSDT-1d", from: 180, to: 250, label: "BTCUSDT · daily" }],
  config: {
    prompt:
      "Drag a box around the range: one edge where price kept failing to rise, the other where it kept finding buyers.",
    shape: "zone",
    side: "both",
    requiredTouches: 6,
  },
  target: { reference: { shape: "zone", top: 11625, bottom: 6591 } },
  tolerance: { priceFracOfRange: 0.02, barSlop: 1 },
  stars: [0.4, 0.7, 0.9],
  misconceptions: [
    {
      id: "too-narrow",
      test: (attempt) => {
        const d = attempt.drawing;
        if (!d || d.shape !== "zone") return false;
        // Less than half the window's actual span.
        return d.top - d.bottom < 2600;
      },
      message:
        "Your box is too tight — price spent this whole period travelling further than that. A range is bounded by the edges price kept returning to, and both of them have to be outside the bulk of the movement.",
    },
    {
      id: "too-wide",
      test: (attempt) => {
        const d = attempt.drawing;
        if (!d || d.shape !== "zone") return false;
        return d.top - d.bottom > 7500;
      },
      message:
        "Your box is wider than the market ever went, so neither edge was ever tested. An edge only means something if price reached it and turned — draw them where that actually happened.",
    },
    {
      id: "single-line",
      test: (attempt) => attempt.drawing === null,
      message:
        "A range needs two edges. Place one point at the level price kept failing to break and another at the level that kept holding.",
    },
  ],
  hints: [
    "The upper edge is around 11,600, tested three times.",
    "The lower edge is near 6,600, which held on six separate occasions.",
  ],
  unlocks: ["measure"],
};
