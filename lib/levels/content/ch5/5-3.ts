import type { Level } from "../../schema";

/**
 * BTCUSDT-1d 1150-1260 (2020-10 to 2021-02), with RSI(14).
 *
 * Measured **through the shipped `rsiSeries`**, which matters: a first pass using a
 * simple mean of gains and losses reported a 26-bar run and a 55.3% gain. Wilder's
 * smoothing — what every chart the player will ever see uses, and what this codebase
 * implements — gives the true figures: RSI held above 70 for **18 consecutive bars**,
 * bars 1179 to 1196, while price rose **21.0%**. The window was widened from 1180 so
 * that the run starts inside it rather than one bar before.
 *
 * Eighteen days of "overbought" through a fifth of a move is the lesson either way,
 * and the smaller true number is the one the level quotes.
 *
 * EURUSD's longest run above 70 in its whole history is 18 bars for 2.1%, which
 * would not make the point; Bitcoin's does. That is why Chapter 5 does not teach
 * exclusively on the euro despite the boss-asset table.
 */
export const level: Level<"classify"> = {
  id: "5-3",
  chapter: 5,
  title: "Overbought is not a sell signal",
  kind: "classify",
  brief:
    "RSI held above 70 for eighteen straight days here while Bitcoin gained 21%. Someone selling the first overbought reading watched the rest from the sidelines.",
  data: [
    { series: "BTCUSDT-1d", from: 1150, to: 1260, label: "BTCUSDT · daily" },
  ],
  config: {
    prompt: "What does a long stretch of RSI above 70 actually tell you?",
    options: [
      {
        id: "strength",
        label: "That buyers are in control, and have been for weeks.",
        note: "Correct. A sustained high reading is what a strong trend looks like from the inside.",
      },
      {
        id: "reversal",
        label: "That a reversal is due — the market is stretched.",
        note: "This is the reading that cost the most here: eighteen days of it, and 21% of upside.",
      },
      {
        id: "noise",
        label: "Nothing at all; RSI is meaningless.",
        note: "Too far. It measured the strength accurately — the error is in treating a level as a signal.",
      },
    ],
  },
  target: { correct: ["strength"] },
  tolerance: {},
  stars: [0.5, 0.75, 0.95],
  misconceptions: [
    {
      id: "rsi-called-reversal",
      test: (attempt) => attempt.selected.includes("reversal"),
      message:
        "That is the expensive reading. RSI crossed 70 on 8 November and stayed above it for eighteen days while price rose 21% — anyone selling the first overbought print watched the rest from the sidelines. An oscillator pinned at an extreme is evidence of strength, not of exhaustion.",
    },
    {
      id: "rsi-dismissed-entirely",
      test: (attempt) => attempt.selected.includes("noise"),
      message:
        "Too far the other way. RSI measured this market accurately — it said the buying was relentless, and it was. The mistake is not the indicator, it is the rule someone attached to it.",
    },
  ],
  hints: [
    "Look at what price did during the stretch where RSI stayed pinned near the top of its pane.",
  ],
};
