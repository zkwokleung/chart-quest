import type { Block } from "@/lib/backtest/blocks";
import type { Level } from "../../schema";

/**
 * The first level where the player builds something and the game runs it.
 *
 * ## What is graded, and why it is not "expectancy above zero"
 *
 * **The premise that failed measurement.** `CURRICULUM.md` and issue #28 both state the objective as
 * "expectancy > 0 over ≥30 trades". On this data spine, with a 2 ATR stop and a 2R target, entering on
 * *every flat bar* returns **+0.27R a trade on the index, +0.39R on Apple, +0.34R on Bitcoin and
 * +0.23R on gold**. Zero is therefore a bar that no entry at all clears comfortably, and during
 * development every two-block rule tried cleared it — including "buy breakdowns below the 200-bar
 * average", which makes a positive +0.03R on the index and is *worse than doing nothing*. Scored
 * against zero, that rule earned three stars.
 *
 * So the objective is `beatBaseline`: the player's entry must beat the same exit with no entry
 * condition, on the same market, over the same window. That is the comparison a backtest should always
 * have carried, and it turns the level's lesson from "make money" into the true one — **most of what a
 * naive backtest shows you is the exit and the market's drift.**
 *
 * ## The exit is fixed here on purpose
 *
 * 10.4 opens it. Asking about the entry and the exit at once would let a player pass by tuning the
 * exit and never learn which half did the work — and the measurement says that is exactly what would
 * happen, because changing the exit moves both the rule and its baseline.
 *
 * ## The reference, and what it beat out
 *
 * `close > sma(200)` and `rsi(14) < 40` — buy the dip inside an uptrend. Measured against its own
 * baseline: the index +0.478 against +0.270 over 49 trades, gold +0.407 against +0.226 over 34.
 *
 * Worth recording what it beat out, because it is the level in one line: `close > sma(200)` plus a
 * break of structure — chasing breakouts in the same uptrend — makes **+0.26R on the index against a
 * baseline of +0.270R**, over 107 trades. Break-even against doing nothing, from a rule that looks
 * like every trend-following rule ever written.
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
  id: "10-3",
  chapter: 10,
  title: "Build the entry",
  kind: "build-rules",
  brief:
    "Compose a rule from what the chapters have taught you. It has to make money on the index and on gold — but that is not the bar. The bar is that it beats entering on every single bar with the same stop and target, because on this data doing exactly nothing pays about a quarter of an R a trade. Your entry has to be worth more than nothing.",
  data: [
    { series: "SPY-1d", from: 210, to: 4612, label: "S&P 500 · daily" },
    { series: "GC-1d", from: 210, to: 4607, label: "Gold · daily" },
  ],
  config: {
    prompt: "Build an entry that beats doing nothing on both markets.",
    palette: "unlocked",
    objective: {
      beatBaseline: true,
      minTrades: 30,
      minAssetsPassing: 2,
    },
    // Fixed so the level asks one question. 10.4 hands the exit over.
    fixed: { exit: { stopAtr: 2, targetR: 2, timeStopBars: 60 } },
  },
  target: {
    reference: {
      entry: DIP_IN_UPTREND,
      exit: { stopAtr: 2, targetR: 2, timeStopBars: 60 },
      risk: { perTradePct: 0.01 },
    },
  },
  tolerance: {},
  stars: [0.45, 0.7, 0.9],
  misconceptions: [
    {
      id: "ch10-3-nothing-composed",
      test: (attempt) => attempt.entry.length === 0,
      message:
        "A rule with no conditions fires on nothing rather than on everything — an empty stack is an unfinished strategy, not a licence to trade every bar. Add a condition from the palette; everything in it is something a chapter taught you.",
    },
    {
      id: "ch10-3-one-condition",
      test: (attempt) => attempt.entry.length === 1,
      message:
        "One condition is a filter rather than a setup, and the most common single condition — price above its 200-bar average — is close to a description of the market rising, which the baseline already captures. Chapter 6 warned about stacking five; two or three is where a rule usually lives.",
    },
    {
      id: "ch10-3-beat-nothing",
      test: () => true,
      message:
        "The column labelled 'doing nothing' is the same stop and target with no entry rule at all — a trade on every bar the position was flat. It pays +0.27R a trade on the index and +0.23R on gold, because both markets rose for eighteen years and a 2R target catches that. Any rule you build inherits it. What the table asks is whether *your entry* added anything, and the honest answer for most rules is very little: chasing breakouts in an uptrend makes +0.26R on the index against that +0.27R, over 107 trades. Buying dips inside the same uptrend makes +0.48R. Same trend, opposite result, and only the comparison tells you which is which.",
    },
  ],
  hints: [
    "Two conditions is usually enough: one for the context, one for the trigger.",
    "The baseline is buying every bar. To beat it you have to be buying different bars, not more of them.",
  ],
};
