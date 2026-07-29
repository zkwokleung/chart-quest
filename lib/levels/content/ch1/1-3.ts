import type { Level } from "../../schema";

/**
 * Both charts end at 2021-01-13 and show the same market.
 *
 * The 4h chart's last 30 bars fell 16.7%. The daily chart's last 60 bars rose
 * 132.5%. Neither is wrong — they are the same data at two zoom levels, which is
 * why "the trend" is not a property of a market but of a timeframe.
 */
export const level: Level<"classify"> = {
  id: "1-3",
  chapter: 1,
  title: "The timeframe illusion",
  kind: "classify",
  brief:
    "These two charts are the same market, ending on the same day. One is falling hard. The other is in a violent uptrend.",
  data: [
    // Starts at 44, not earlier: the visible window has to fall end-to-end. An
    // earlier start includes the rise before it and the chart reads as a top,
    // which is a different lesson.
    { series: "BTCUSDT-4h", from: 44, to: 75, label: "Chart A · BTCUSDT 4-hour" },
    { series: "BTCUSDT-1d", from: 1185, to: 1246, label: "Chart B · BTCUSDT daily" },
  ],
  config: {
    prompt: "Which chart shows the real trend?",
    options: [
      {
        id: "a",
        label: "Chart A — it is the more recent, higher-resolution view.",
      },
      {
        id: "b",
        label: "Chart B — the bigger picture is the one that counts.",
      },
      {
        id: "both",
        label:
          "Both. A trend is a property of a timeframe, not of a market, so the question has no single answer.",
        note: "The 4-hour leg fell 16.7% inside a daily advance of 132.5%. Both measurements are correct.",
      },
      {
        id: "neither",
        label: "Neither — one of the two charts must be plotting bad data.",
      },
    ],
  },
  target: { correct: ["both"] },
  tolerance: {},
  stars: [0.5, 0.9, 1],
  misconceptions: [
    {
      id: "picked-a-timeframe",
      test: (attempt) =>
        attempt.selected.includes("a") || attempt.selected.includes("b"),
      message:
        "Both charts are accurate. Choosing one as 'the real trend' is the mistake — you have to say which timeframe you mean, because a pullback on the daily is a full downtrend on the 4-hour.",
    },
    {
      id: "assumed-bad-data",
      test: (attempt) => attempt.selected.includes("neither"),
      message:
        "The data is the same in both, drawn from the same series. The disagreement comes from the zoom level, not from an error.",
    },
  ],
  hints: [
    "Check the dates on both charts before deciding which one to trust.",
    "Could a market be falling over five days and rising over three months at the same time?",
  ],
  unlocks: ["timeframe"],
};
