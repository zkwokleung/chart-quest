import type { Level } from "../../schema";

/**
 * Six indicators on one chart, and the point is what they have in common.
 *
 * Every one of them — the two averages, the bands, the RSI, the MACD — is a
 * function of the same closes. They are not six opinions. They are six
 * rearrangements of one series, so their agreement carries far less information
 * than six independent sources agreeing would, and their disagreement is not a
 * puzzle to resolve by adding a seventh.
 *
 * That claim needs no window-specific measurement, because it is true by
 * construction: the content-claims test asserts it the only way it can be asserted,
 * by checking that every indicator on the chart takes the same series as input.
 */
export const level: Level<"classify"> = {
  id: "5-6",
  chapter: 5,
  title: "Indicator soup",
  kind: "classify",
  brief:
    "Two averages, a band, an oscillator and a momentum histogram, all on one chart. When they disagree, which one is right?",
  data: [
    { series: "EURUSD-1d", from: 4150, to: 4300, label: "EURUSD · daily" },
  ],
  config: {
    prompt: "Six indicators, one chart. What is their agreement worth?",
    options: [
      {
        id: "same-input",
        label:
          "Little — they are all computed from the same closes, so they cannot confirm each other.",
        note: "Correct. Six functions of one series are one opinion, restated six times.",
      },
      {
        id: "majority",
        label: "Go with the majority: four out of six is a decent signal.",
        note: "A majority of six views of the same number is still one number.",
      },
      {
        id: "add-more",
        label: "Add more indicators until a clear consensus emerges.",
        note: "Each addition is another rearrangement of the same closes, and another chance to find the answer you wanted.",
      },
    ],
  },
  target: { correct: ["same-input"] },
  tolerance: {},
  stars: [0.5, 0.75, 0.95],
  misconceptions: [
    {
      id: "soup-counted-votes",
      test: (attempt) => attempt.selected.includes("majority"),
      message:
        "Counting votes assumes the voters are independent, and these are not: every line on this chart is arithmetic performed on the same closing prices. A moving average agreeing with a MACD is not corroboration — the MACD is built out of moving averages.",
    },
    {
      id: "soup-wanted-more",
      test: (attempt) => attempt.selected.includes("add-more"),
      message:
        "Another indicator is another rearrangement of the same series, and another opportunity to keep looking until something agrees with you. That is the mechanism Chapter 9 makes you do deliberately so you can recognise it when you do it by accident.",
    },
  ],
  hints: [
    "Ask what each of these is computed from, and whether any of them knows anything the others do not.",
  ],
};
