import type { Block } from "@/lib/backtest/blocks";
import type { Level } from "../../schema";

/**
 * Three markets, three asset classes, and the objective the whole game's promise rests on.
 *
 * `CURRICULUM.md`: *"10.7 is the change that makes the whole game's promise true. 'Works on one series'
 * was the old objective and it would have certified overfit strategies as finished work."* So the
 * objective is stated over **asset classes** rather than markets, and the guard that enforces it counts
 * distinct classes: three equities are one class, which is the mistake this level exists to make
 * impossible.
 *
 * ## Why two of three rather than three of three
 *
 * 10.5 asked for all three, on markets chosen so that all three could clear it. This asks for two of
 * three, and the third market is why. Measured: the reference strategy takes **18 trades on
 * `BTCUSDT-1d`** — below the sample-size threshold — so it comes back `inconclusive` rather than as a
 * pass or a fail.
 *
 * That is the honest treatment and it took a third verdict in `guards.ts` to express. An asset that
 * traded eighteen times has not failed, and counting it as a failure would make the cross-asset test a
 * measure of how much history a market happens to have rather than of whether the rule travels.
 * Bitcoin's daily series holds 2,778 bars against the equities' 4,612, because Bitcoin did not exist in
 * 2005 — and a rule should not be marked down for the age of an asset class.
 *
 * So: two classes must clear it, the third may be inconclusive, and a rule that *fails* on a real
 * sample is refuted. The player sees all three columns either way.
 *
 * ## The reference
 *
 * The same dip rule, now on one equity, one commodity and one crypto. The index clears (+0.478 against
 * +0.270 over 49 trades) and gold clears (+0.407 against +0.226 over 34) — equity and futures, two
 * classes. Bitcoin returns 18 trades at −0.405 and is reported as too few to say. The claims test
 * recomputes all three.
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
  id: "10-7",
  chapter: 10,
  title: "Does it travel",
  kind: "build-rules",
  brief:
    "One equity, one commodity, one crypto. Two of the three have to beat doing nothing, and they have to be two different kinds of market — because a rule that works on three shares has been tested once, not three times. If a market comes back with too few trades to judge, that is not a failure. It is the honest answer, and you have to be able to tell the difference.",
  data: [
    { series: "SPY-1d", from: 210, to: 4612, label: "S&P 500 · an index" },
    { series: "GC-1d", from: 210, to: 4607, label: "Gold · a commodity" },
    { series: "BTCUSDT-1d", from: 210, to: 2778, label: "Bitcoin · crypto" },
  ],
  config: {
    prompt: "Two asset classes must beat their own baseline. Three shares would not count.",
    palette: "unlocked",
    objective: {
      beatBaseline: true,
      minTrades: 20,
      minAssetsPassing: 2,
      minClassesPassing: 2,
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
      id: "ch10-7-crypto-only",
      test: (attempt) => attempt.entry.some((block) => block.kind === "volatility"),
      message:
        "A volatility condition is the most market-specific block in the palette, and Chapter 8 measured why: an ordinary day is 1.1% on the index, 2.3% on Apple and 3.7% on the small-cap. A threshold that selects good setups on one of those may select nothing at all on another — which is a rule that has not travelled, dressed as a rule that is selective. If you use it, check the trade counts on all three markets before you check anything else.",
    },
    {
      id: "ch10-7-classes-not-markets",
      test: () => true,
      message:
        "The line that counts asset classes rather than markets is the whole reason this level exists. A rule that beats doing nothing on the index, Apple and the small-cap has been tested on one thing — 8.4 measured it: the only pair on this spine that clears a correlation of 0.6 is a stock against its own index. And a market coming back 'too few to say' is a third answer, not a failure: Bitcoin's daily series holds 2,778 bars against the equities' 4,612 because Bitcoin did not exist in 2005, and a rule should not be marked down for the age of an asset class. What it should be marked down for is only ever having been tried on one.",
    },
  ],
  hints: [
    "Check the trade count on all three markets before the expectancy on any of them.",
    "If one market has too few trades, that is reported as inconclusive — you need two that are not.",
  ],
};
