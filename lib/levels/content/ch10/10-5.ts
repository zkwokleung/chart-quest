import type { Block } from "@/lib/backtest/blocks";
import type { Level } from "../../schema";

/**
 * The in-sample run, on everything the player is allowed to see.
 *
 * ## The objective, and the one word that changed in it
 *
 * `CURRICULUM.md`: "in-sample backtest — expectancy > 0 over ≥30 trades". The trade count survives
 * measurement comfortably — the reference takes 49, 34 and 51 trades on the three markets — and the
 * expectancy bar does not, for the reason recorded in 10.3: entering on every flat bar with the same
 * exit pays +0.27R on the index, +0.23R on gold and +0.39R on Apple. Zero is a bar that no entry at all
 * clears.
 *
 * So this is 10.3's and 10.4's objective on three markets rather than two, and **all three must clear
 * it**. That is the strictest objective in the chapter and it is deliberately stricter than 10.7's,
 * which asks for two of three: here the player still has every bar of history to look at, so a rule
 * that cannot beat doing nothing on all three of them has not earned the holdback.
 *
 * ## Why Apple is the third market rather than Bitcoin
 *
 * Measured: the reference takes **18** trades on `BTCUSDT-1d`, which is below the sample-size threshold
 * and comes back `inconclusive` rather than as a pass or a fail. Making it the third market here would
 * mean the strictest level in the chapter could not be cleared on the merits — the guard would fail on
 * correct content, which is what happened to the first draft. Bitcoin arrives in 10.7, where
 * inconclusive is the honest outcome and the objective is written to allow it.
 */

const DIP_IN_UPTREND: Block[] = [
  {
    kind: "compare",
    left: { kind: "close" },
    op: ">",
    right: { kind: "sma", period: 200 },
  },
  { kind: "compare", left: { kind: "rsi", period: 14 }, op: "<", right: 40 },
];

export const level: Level<"build-rules"> = {
  id: "10-5",
  chapter: 10,
  title: "Everything you are allowed to see",
  kind: "build-rules",
  brief:
    "Three markets now, and all three have to beat doing nothing over at least thirty trades. This is every bar the game has ever shown you — eighteen years of it — and it is the last time you get to change anything. Whatever you commit here is what runs on the data you have never seen.",
  data: [
    { series: "SPY-1d", from: 210, to: 4612, label: "S&P 500 · daily" },
    { series: "GC-1d", from: 210, to: 4607, label: "Gold · daily" },
    { series: "AAPL-1d", from: 210, to: 4612, label: "Apple · daily" },
  ],
  config: {
    prompt: "All three markets, thirty trades each, beating the baseline on every one.",
    palette: "unlocked",
    objective: {
      beatBaseline: true,
      minTrades: 30,
      minAssetsPassing: 3,
    },
  },
  target: {
    reference: {
      entry: DIP_IN_UPTREND,
      exit: { stopAtr: 2, targetR: 2, timeStopBars: 60 },
      risk: { perTradePct: 0.01 },
    },
  },
  tolerance: {},
  stars: [0.5, 0.75, 0.9],
  misconceptions: [
    {
      id: "ch10-5-too-few-trades",
      test: (attempt) => attempt.entry.length >= 4,
      message:
        "Four conditions or more and the trade count is about to collapse. Chapter 6.5 was built on this: each confirmation you stack feels like more evidence and is actually less sample. The threshold here is thirty trades a market, and a five-condition rule on eighteen years of daily bars often finds nine.",
    },
    {
      id: "ch10-5-many-variants",
      test: (attempt) => attempt.variants >= 10,
      message:
        "You are past ten variants, which is where 9.5's lesson starts applying to you rather than to a level. Twenty-six lookbacks were swept there and the best one placed 25th of 26 on the years it was not chosen on. Nothing here stops you tuning — but the more variants you try, the more likely it is that the one that finally passes is the luckiest rather than the truest, and the held-back data is about to be the only thing that can tell the difference.",
    },
    {
      id: "ch10-5-last-chance",
      test: () => true,
      message:
        "Three markets, thirty trades each, every one beating what the market paid for nothing — that is the strictest thing this chapter asks, and it is stricter than the cross-asset level that follows. The reason is that you can still see everything here. Once 10.6 runs, the data answers back and you cannot revise the question. Save what you commit: 10.6 reads the strategy you saved, and it is about to produce nine trades on the index.",
    },
  ],
  hints: [
    "Thirty trades on eighteen years of daily bars means firing roughly twice a year. Two conditions, not five.",
    "If one market fails, look at whether your rule needs that market's character rather than adding a condition.",
  ],
};
