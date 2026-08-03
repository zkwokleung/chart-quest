import type { Level } from "../../schema";

/**
 * A trade you already know worked, and the only question left.
 *
 * ## The specified level cannot be graded
 *
 * `CURRICULUM.md` asks for "a replay you already solved, re-shown honestly". A graded level may
 * not depend on the player's history: they may have skipped 3.B, or scored zero on it, and there
 * is no honest way to grade "the trade you did earlier" for someone who did not do it. The
 * chapter's own invariant — every Chapter 9 level completable with an empty store — rules it out.
 *
 * The honest inverse *is* gradeable, and it is the better level. **Tell the player the outcome
 * first**, then ask for the plan, and score the plan alone. Once you know it worked, the only
 * thing left to judge is whether you would have deserved it — which is what hindsight bias
 * actually costs you, and it needs no memory of an earlier level.
 *
 * `outcomeWeight: 0` is what makes that real rather than rhetorical. Every other replay level
 * gives the outcome 0.3 of the score; here a known result carries nothing, because scoring it
 * would be scoring hindsight. A test asserts the eight existing replay levels and steps are
 * unaffected.
 *
 * ## The window
 *
 * GC-1d bar 3508 (2018-12-19), entry 1252.10, ATR(14) 8.229, with a swing low at **1234.10** —
 * 2.19x ATR below entry. Total risk from entry, 2R target, 60 bars:
 *
 *   0.20x  −5.41R      1.50x  +2.00R      3.00x  +2.00R
 *   0.35x  −3.09R      2.00x  +2.06R      4.00x  +2.00R
 *   0.50x  −2.16R      2.19x  +2.00R      4.50x  +2.00R
 *   1.00x  −1.08R      2.50x  +2.05R      5.00x  +2.00R
 *
 * Every width that clears the structure reaches the target, out to five ATR. And the tight stops
 * do not merely lose — **they lose multiples**, because price gapped through them and a small R
 * denominator turns a gap into a catastrophe. −5.41R from a stop a fifth of an ATR away is the
 * most expensive cell in any level in this game, and it is the same lesson 1.6 taught with no
 * money attached.
 *
 * Gold, which no other Chapter 9 level displays — 9.1, 9.2, 9.3, 9.5 and 9.6 all carry
 * `data: []` — so 9.B has five series left to choose three from.
 */
export const level: Level<"replay-trade"> = {
  id: "9-4",
  chapter: 9,
  title: "You already know it worked",
  kind: "replay-trade",
  brief:
    "This trade made two R. I am telling you that before you place anything, because the interesting question is not whether it worked — you know that now — it is whether the plan you would have made deserved it. Your score here comes entirely from the plan. The outcome is worth nothing, because you have already been given it.",
  data: [{ series: "GC-1d", from: 3448, to: 3568, label: "Gold · daily" }],
  config: {
    prompt:
      "Place the stop and target you would have used, and say why. Only the plan is scored.",
    side: "long",
    // A breakout continuing, with the pullback low beneath it as the structure.
    setup: "continuation",
    primeBars: 61,
    maxBars: 60,
    minRR: 2,
    atrPeriod: 14,
    // **Hindsight is not skill.** Every other replay level gives the outcome 0.3 of the score;
    // here the player was handed the outcome, so letting it carry any weight would pay them for
    // knowing something they were told.
    outcomeWeight: 0,
  },
  target: {
    structure: { shape: "level", price: 1234.1 },
    triggerBar: 3508,
  },
  // Total risk from entry, in ATR. The low sits 2.19x below, so 2.2 is the first width clearing
  // it and 4.5 the widest verified to still reach 2R inside the window.
  tolerance: { minAtr: 2.2, maxAtr: 4.5, barSlop: 2 },
  stars: [0.5, 0.75, 0.95],
  misconceptions: [
    {
      id: "hindsight-tight-stop-on-a-known-winner",
      test: (attempt, lvl, data) => {
        const series = data[0];
        const entry = series?.c[lvl.target.triggerBar];
        if (entry === undefined) return false;
        // Under one ATR of room, on a trade whose structure sits 2.19 ATR away.
        return entry - attempt.stop < 8.229;
      },
      message:
        "Knowing the trade worked makes a tight stop feel safe — you know price went up, so why leave room? Because the path is not the outcome. A stop a fifth of an ATR from entry lost **5.41R** here: price gapped through it on the very next bar, and a small risk turns a gap into a multiple. Every width that cleared the low made two R. The outcome you were given tells you nothing about which of those you would have survived.",
    },
    {
      id: "hindsight-stop-inside-the-structure",
      test: (attempt, lvl) => {
        const structure = lvl.target.structure;
        if (structure.shape !== "level") return false;
        return attempt.stop > structure.price;
      },
      message:
        "Your stop sits above the low the breakout came from. It happens to have survived — this trade worked, which is why you were told so up front — and it is still the wrong plan. Two thirds of the widths inside that low lost money on this window, and you had no way of knowing you were in the third that did not.",
    },
    {
      id: "hindsight-no-reason-given",
      test: (attempt) => attempt.reason.trim().length < 15,
      message:
        "Write down why. This is the last trade you place before Chapter 10 asks you to build a strategy out of your own record, and 9.6 has just shown you what that record looks like — including how many of your trades carry no stated reason at all.",
    },
  ],
  hints: [
    "Find the low the breakout came from, and ask what a stop above it would need to be true.",
    "You know the outcome. Plan as though you did not.",
  ],
};
