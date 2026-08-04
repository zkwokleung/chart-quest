import type { Block } from "@/lib/backtest/blocks";
import type { Level } from "../../schema";

/**
 * Where the trade is wrong, chosen by the player for the first time.
 *
 * ## The specified level asked for two things, and this grades one
 *
 * `CURRICULUM.md` asks for "invalidation and sizing — via `InstrumentSpec`, so it's tradeable in your
 * actual market". Sizing is already graded five times: 7.1 through 7.5 and 7.B, from real contract
 * terms, in four instrument classes. A sixth would be a Chapter 7 level wearing a Chapter 10 number,
 * and Chapter 10 has seven slots for eight ideas.
 *
 * So what is **graded** here is invalidation — the exit, opened up for the first time — and sizing is
 * *shown*: the readout states what one R costs in contracts on each market at the player's chosen
 * risk, from `specFor`. Displayed rather than scored, the same split 9.6 used with the journal.
 *
 * ## Why the exit is a real decision and not a knob
 *
 * Because the baseline moves with it. `beatBaseline` runs the always-enter rule through *the player's
 * own exit*, so widening the stop does not quietly inflate the comparison — it changes both sides. The
 * measurement makes that concrete: the same dip rule that beats its baseline on the index at a 2 ATR
 * stop and a 2R target **stops beating it at 1.5 ATR and 3R** (+0.248 against +0.288), while on gold
 * the wider version does better (+0.587 against +0.284). One exit, two markets, opposite verdicts.
 *
 * That is the level. An exit is not a preference; it decides whether your entry has an edge, and the
 * same entry can have one on one market and not on another purely because of where the stop went.
 *
 * ## The reference
 *
 * The same entry as 10.3 with the exit stated rather than imposed: 2 ATR, 2R, 60 bars. Measured on the
 * index +0.478 against a baseline of +0.270 over 49 trades, and on gold +0.407 against +0.226 over 34.
 * The claims test recomputes both, and also recomputes the 1.5 ATR case the misconception quotes.
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
  id: "10-4",
  chapter: 10,
  title: "Where it is wrong",
  kind: "build-rules",
  brief:
    "Now you choose the exit as well: how far away the stop sits, in ATR, and how far the target is in multiples of that risk. Both are stated in ATR and R rather than in price, so the same rule means the same thing on every market. Be careful — the comparison moves with you. Widening your stop widens the baseline's too.",
  data: [
    { series: "SPY-1d", from: 210, to: 4612, label: "S&P 500 · daily" },
    { series: "GC-1d", from: 210, to: 4607, label: "Gold · daily" },
  ],
  config: {
    prompt: "Choose the entry and the exit. Both markets must beat doing nothing.",
    palette: "unlocked",
    objective: {
      beatBaseline: true,
      minTrades: 30,
      minAssetsPassing: 2,
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
  stars: [0.45, 0.7, 0.9],
  misconceptions: [
    {
      id: "ch10-4-tight-stop",
      test: (attempt) => attempt.exit.stopAtr < 1,
      message:
        "A stop under one ATR is inside an ordinary day's range, so it is not marking where you are wrong — it is marking noise. Chapter 7.4 measured the cost: a stop a fifth of an ATR from entry on gold got gapped through for −5.41R, the most expensive cell in any level in this game. You cannot be stopped out of a correct idea by a normal Tuesday and call the idea tested.",
    },
    {
      id: "ch10-4-wide-stop-far-target",
      test: (attempt) => attempt.exit.stopAtr >= 3 && (attempt.exit.targetR ?? 0) >= 3,
      message:
        "A wide stop with a far target needs a very large move inside the time limit, and 7.4 found the ceiling: at 2.50× ATR the trade reaches 2R and at 2.60× it runs out of bars. The target moves away as the stop widens, because it is a multiple of your risk — so the pair has to be chosen together rather than each made 'safer' on its own.",
    },
    {
      id: "ch10-4-exit-decides-the-edge",
      test: () => true,
      message:
        "The exit is not a preference. The same dip rule you built in 10.3 beats doing nothing on the index at a 2 ATR stop and a 2R target — +0.478R against +0.270R over 49 trades — and stops beating it at 1.5 ATR and 3R, where it makes +0.248R against a baseline of +0.288R. On gold the wider version does better: +0.587R against +0.284R. Same entry, same two markets, opposite verdicts, decided entirely by where the stop went. This is also why the comparison has to run through your own exit: a backtest that let you widen the stop without widening the benchmark would reward you for taking more risk and call it an edge.",
    },
  ],
  hints: [
    "Try the same entry with two different stops and watch both columns move, not one.",
    "The target is a multiple of your risk, so widening the stop pushes the target further away too.",
  ],
};
