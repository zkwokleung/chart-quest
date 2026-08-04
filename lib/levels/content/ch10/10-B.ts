import type { Block } from "@/lib/backtest/blocks";
import type { Level } from "../../schema";

/**
 * The last level in the game: two markets it has never taught on, and the document you leave with.
 *
 * ## Why these two markets
 *
 * The cross-asset boss rule, applied to the chapter that exists to enforce it. Chapter 10 taught on the
 * index, gold, Apple and Bitcoin, so the boss runs on **the small-cap and the euro** — the two markets
 * in the spine that Chapter 10 never showed, and the two least like the ones the player tuned on. A
 * rule fitted to eighteen years of large-cap drift has no business working on a micro-cap with a median
 * volume of 18,500 shares or on a currency that went nowhere for a decade.
 *
 * Measured, and this is the reward: the reference does work on both. LAKE-1d takes 21 trades at +0.131R
 * against a baseline of **−0.022R** — a market where entering at random *loses* money, so the rule's
 * whole return is the rule. EURUSD-1d takes 25 trades at +0.641R against +0.044R. Equity and fx, two
 * asset classes, neither of them ones the chapter practised on.
 *
 * ## The trade counts are small, and the level says so rather than hiding it
 *
 * Twenty-one and twenty-five. Above the threshold and not by much, which is the honest state of a
 * selective rule on two markets — and the last thing this game has to say is that you act on evidence
 * this thin or you do not act at all. The readout labels them, the playbook carries them, and the
 * closing message does not pretend the numbers are stronger than they are.
 *
 * ## Why a `build-rules` level rather than a `composite`
 *
 * `build-rules` cannot be a composite step: it runs over a *set* of series chosen by its own config, so
 * a stage of it would widen the boss's scope past anything the cross-asset guard can see. The boss is
 * therefore one question — does it travel to markets you did not tune on — with the playbook rendered
 * after the commit. Which is the right shape anyway: the export is a consequence of clearing the level,
 * not a second thing to be graded.
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
  id: "10-B",
  chapter: 10,
  title: "Two markets you never tuned on",
  kind: "build-rules",
  brief:
    "The last thing. An illiquid small-cap and a currency — two markets this chapter has never shown you, chosen because they are the least like the ones you built on. Two of them have to beat doing nothing, and they are two different asset classes, so there is nowhere to hide. Clear it and the game writes your playbook.",
  data: [
    { series: "LAKE-1d", from: 210, to: 4612, label: "An illiquid small-cap · daily" },
    { series: "EURUSD-1d", from: 210, to: 4755, label: "EUR/USD · daily" },
  ],
  config: {
    prompt:
      "Both markets, both beating their own baseline. Neither is one you tuned on.",
    palette: "unlocked",
    objective: {
      beatBaseline: true,
      // Twenty is the journal's own threshold, and the honest floor here: a selective rule finds 21
      // trades on the small-cap in eighteen years. Asking for thirty would fail correct content.
      minTrades: 20,
      minAssetsPassing: 2,
      minClassesPassing: 2,
    },
    playbook: true,
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
      id: "boss10-empty",
      test: (attempt) => attempt.entry.length === 0,
      message:
        "Nothing composed, so nothing traded. Everything in the palette is something one of the nine chapters behind you taught — this is the level where that stops being a metaphor.",
    },
    {
      id: "boss10-overtuned",
      test: (attempt) => attempt.variants >= 15,
      message:
        "Fifteen variants or more on markets you had never seen until this level. That is the sequence 9.5 measured: search until something passes, and what passes is the thing that fitted the search. If a rule needed this much finding on the small-cap and the euro, what you have found is these two series rather than an edge.",
    },
    {
      id: "boss10-the-end",
      test: () => true,
      message:
        "That is the whole game. What you built ran on an illiquid small-cap and a currency — two markets this chapter never showed you, picked because they are the least like the eighteen years of large-cap drift you tuned on. On the small-cap, entering at random loses money, so anything the rule made there is the rule rather than the market. And the trade counts are twenty-one and twenty-five: above the line, and not by much. That is what a real edge looks like from the inside — thin, checkable, and surrounded by things you cannot conclude. You started by learning that you could not predict the next bar and you were right about that; what changed is that you can now say how much you do not know, in numbers, with the sample size attached. Your playbook is below. Read the failure modes first — in six months they are the part you will have forgotten, and they are the only part that will still be true.",
    },
  ],
  hints: [],
};
