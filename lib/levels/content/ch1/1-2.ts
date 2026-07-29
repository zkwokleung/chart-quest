import type { Level } from "../../schema";

/**
 * BTCUSDT-1d bar 104 (2017-11-29): open 9896.79, high 11300.03, low 8520,
 * close 9687.88.
 *
 * The range is 28.7% of the close while the body is only 7.5% of that range —
 * price travelled roughly a quarter of its own value and came back. A line chart,
 * which plots closes only, shows this as a small down day.
 */
export const level: Level<"classify"> = {
  id: "1-2",
  chapter: 1,
  title: "What a line chart hides",
  kind: "classify",
  brief:
    "On 29 November 2017, Bitcoin's high and low were 28.7% apart — and it closed almost exactly where it opened. A line chart draws only closes.",
  data: [{ series: "BTCUSDT-1d", from: 80, to: 130, label: "BTCUSDT · daily" }],
  config: {
    prompt:
      "A line chart of this same period would show 29 November as an unremarkable small decline. What would it be hiding?",
    options: [
      {
        id: "quiet",
        label: "Nothing — it was a quiet day, and the candle agrees.",
      },
      {
        id: "travelled",
        label:
          "That price travelled roughly a quarter of its value intraday before returning to where it started.",
        note: "High 11300.03, low 8520, close 9687.88 against an open of 9896.79.",
      },
      {
        id: "volume",
        label: "That the day's volume was unusually low.",
      },
      {
        id: "gap",
        label: "That the market was closed for part of the day.",
        note: "Bitcoin trades continuously — there is no session to close.",
      },
    ],
  },
  target: { correct: ["travelled"] },
  tolerance: {},
  stars: [0.5, 0.9, 1],
  misconceptions: [
    {
      id: "trusted-the-close",
      test: (attempt) => attempt.selected.includes("quiet"),
      message:
        "The close was quiet; the day was not. Open and close were within 2% of each other while the high and low were 28.7% apart — that distance is exactly what a line chart discards.",
    },
    {
      id: "read-volume-instead",
      test: (attempt) => attempt.selected.includes("volume"),
      message:
        "Volume is a separate series, and a line chart of price hides nothing about it either way. What it hides here is the distance price covered between its high and its low.",
    },
    {
      id: "assumed-a-session",
      test: (attempt) => attempt.selected.includes("gap"),
      message:
        "Bitcoin trades 24/7, so there is no closed session to hide. The missing information is the intraday range — the wicks.",
    },
  ],
  hints: [
    "A line chart plots one price per bar. Which one, and what does that leave out?",
    "Compare the candle's open and close against its high and low.",
  ],
};
