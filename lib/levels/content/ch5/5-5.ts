import type { Level } from "../../schema";

/**
 * The normalization keystone: the same 3% day on three markets.
 *
 * Measured across the committed spine, as a share of price:
 *
 *   BTCUSDT-1d  median daily ATR 4.60%   85.6% of days exceed 3%
 *   SPY-1d      median daily ATR 1.11%    4.2% of days exceed 3%
 *   EURUSD-1d   median daily ATR 0.82%    0.8% of days exceed 3%
 *
 * The curriculum's line is "BTC 3%/day is Tuesday, SPY 3%/day is a crisis". The
 * measurement says the first half *understates* it — 3% is a quiet day for Bitcoin,
 * below its median — and that is the version the level uses.
 *
 * `yAxis: "atr"` starts the chart in ATR-multiples so the comparison is visible
 * rather than argued. The toggle is on, because seeing the same three charts flip
 * between price and ATR units is the moment the idea lands.
 */
export const level: Level<"classify"> = {
  id: "5-5",
  chapter: 5,
  title: "Big for which market?",
  kind: "classify",
  brief:
    "Three markets, three months, all drawn in multiples of their own daily range. A 3% day is a quiet Tuesday on one of these and a once-a-year event on another.",
  data: [
    { series: "BTCUSDT-1d", from: 1500, to: 1590, label: "A · BTCUSDT" },
    { series: "SPY-1d", from: 4200, to: 4290, label: "B · SPY" },
    { series: "EURUSD-1d", from: 4200, to: 4290, label: "C · EURUSD" },
  ],
  config: {
    prompt:
      "On which of these would a single 3% day be genuinely extraordinary?",
    multiple: true,
    options: [
      {
        id: "a",
        label: "A — Bitcoin",
        note: "No: 86% of Bitcoin's days exceed 3%. Its median day is 4.6%.",
      },
      {
        id: "b",
        label: "B — SPY",
        note: "Yes: SPY exceeds 3% on 4% of days, against a median of 1.11%.",
      },
      {
        id: "c",
        label: "C — the euro",
        note: "Yes, most of all: 0.8% of days, against a median of 0.82%.",
      },
    ],
  },
  target: { correct: ["b", "c"] },
  tolerance: {},
  yAxis: "atr",
  stars: [0.5, 0.75, 0.95],
  misconceptions: [
    {
      id: "atr-called-btc-extraordinary",
      test: (attempt) => attempt.selected.includes("a"),
      message:
        "Bitcoin's median day is a 4.6% range, and 86% of its days are wider than 3%. A 3% day there is quieter than usual — the figure only sounds dramatic if you are carrying an equity intuition into a market that does not share it.",
    },
    {
      id: "atr-picked-only-one",
      test: (attempt) => attempt.selected.length === 1,
      message:
        "Two of the three qualify. SPY clears 3% on about one day in twenty-four and the euro on about one in a hundred and twenty — both are events, and the euro's are rarer.",
    },
  ],
  hints: [
    "The axis is already in multiples of each market's own daily range. Ask how many of those multiples 3% would be on each.",
  ],
};
