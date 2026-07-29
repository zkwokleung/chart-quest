import type { Level } from "../../schema";

/**
 * Four BTC windows whose structure was measured with `readStructure` rather than
 * eyeballed: A is an uptrend, B a downtrend, C and D ranges.
 *
 * Only one is a downtrend, so the question has a single answer.
 */
export const level: Level<"classify"> = {
  id: "2-2",
  chapter: 2,
  title: "Higher highs, lower lows",
  kind: "classify",
  brief:
    "A trend is a sequence, not a feeling: higher highs with higher lows, or lower highs with lower lows. Anything else is a range.",
  data: [
    { series: "BTCUSDT-1d", from: 0, to: 70, label: "A" },
    { series: "BTCUSDT-1d", from: 150, to: 220, label: "B" },
    { series: "BTCUSDT-1d", from: 90, to: 160, label: "C" },
    { series: "BTCUSDT-1d", from: 320, to: 390, label: "D" },
  ],
  config: {
    prompt: "Which window makes lower highs AND lower lows?",
    options: [
      { id: "a", label: "A", note: "Higher highs and higher lows — an uptrend." },
      { id: "b", label: "B", note: "Each peak lower than the last, and each trough too." },
      { id: "c", label: "C", note: "Peaks and troughs overlap — a range, however violent." },
      { id: "d", label: "D", note: "Also a range: the highs and lows go nowhere in particular." },
    ],
  },
  target: { correct: ["b"] },
  tolerance: {},
  stars: [0.5, 0.9, 1],
  misconceptions: [
    {
      id: "picked-a-range",
      test: (attempt) =>
        attempt.selected.includes("c") || attempt.selected.includes("d"),
      message:
        "That window is a range. Price fell hard inside it, but its peaks and troughs overlap rather than stepping down — a big decline is not the same as a downtrend.",
    },
    {
      id: "picked-the-uptrend",
      test: (attempt) => attempt.selected.includes("a"),
      message:
        "That one steps upwards: each peak above the last, each trough above the last. Read the sequence of turns rather than the overall direction of travel.",
    },
  ],
  hints: [
    "Ignore how far price moved. Compare each peak with the peak before it.",
    "A downtrend needs both: lower highs and lower lows.",
  ],
};
