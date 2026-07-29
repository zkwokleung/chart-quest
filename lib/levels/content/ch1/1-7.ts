import type { Level } from "../../schema";

/**
 * AAPL-1d-raw, the whole 86-bar slice.
 *
 * These are split-unadjusted prices, reconstructed by inverting Apple's 4:1 split
 * of 2020-08-31 (see docs/DATA.md). The chart therefore shows a 74.2% single-day
 * collapse that never happened: holders woke up with four times as many shares at
 * a quarter of the price, and were exactly as wealthy as the night before.
 *
 * The only level allowed to use this series — a guard enforces that, because it is
 * deliberately misleading data.
 */
export const level: Level<"classify"> = {
  id: "1-7",
  chapter: 1,
  title: "The crash that never happened",
  kind: "classify",
  brief:
    "This chart of Apple shows a 74.2% fall in a single day, in August 2020. Nobody lost 74% of their money that day.",
  data: [{ series: "AAPL-1d-raw", from: 0, to: 86, label: "AAPL · daily, unadjusted" }],
  config: {
    prompt: "So what is this chart actually showing?",
    options: [
      {
        id: "split",
        label:
          "A stock split. Each share became four cheaper shares, so the price per share fell while the value held did not change.",
        note: "Apple split 4:1 on 31 August 2020. Adjusted data rewrites the earlier prices; this chart does not.",
      },
      {
        id: "crash",
        label: "A genuine crash, which the market then recovered from.",
      },
      {
        id: "bad-data",
        label: "Corrupt data — the price series is simply wrong here.",
      },
      {
        id: "dividend",
        label: "A large dividend being paid out of the share price.",
      },
    ],
  },
  target: { correct: ["split"] },
  tolerance: {},
  stars: [0.5, 0.9, 1],
  misconceptions: [
    {
      id: "read-it-as-a-crash",
      test: (attempt) => attempt.selected.includes("crash"),
      message:
        "No recovery follows, because nothing was lost. Apple split 4:1 that night: a holder of 100 shares at $499 held 400 at $125, and the chart only shows one side of that.",
    },
    {
      id: "blamed-the-data",
      test: (attempt) => attempt.selected.includes("bad-data"),
      message:
        "The prices are exactly what the tape printed. They are unadjusted, which is a choice rather than an error — and the reason almost every chart you see silently rewrites its own history.",
    },
    {
      id: "guessed-dividend",
      test: (attempt) => attempt.selected.includes("dividend"),
      message:
        "A dividend does reduce the price, but by its own size — a fraction of a percent here. Nothing pays out three quarters of a company's value in one night.",
    },
  ],
  hints: [
    "Ask what could quarter a share price overnight without anyone losing money.",
    "The number of shares can change as well as their price.",
  ],
};
