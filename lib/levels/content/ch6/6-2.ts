import type { Level } from "../../schema";

/**
 * SPY-15m 758-840 with SPY-1h 160-194 above it, trigger bar 818 (2026-07-16 16:30).
 *
 * The first level where both panes are live. `LevelPlayer` links them — the fifteen drives,
 * the hour follows — so the hourly bar in progress never shows a close it has not reached.
 * **Slice 0 is the traded timeframe**, which is why the fifteen is listed first:
 * `ReplayTrade` places the trade on slice 0 and `simulate` scores it there.
 *
 * The setup is an hourly swing high at **753.31** (1h bar 174), retested by a fifteen-minute
 * bearish reversal bar closing at 751.97. ATR(14) on the fifteen is 1.449.
 *
 * **The hourly pane runs from 160, not 174, and that is a correction.** A first draft started
 * it at 174 — so the level the whole trade rests on was set by the very first bar on screen,
 * with nothing before it to show that price had turned there. A pane that does not contain
 * the level's own history is not showing the setup. At 160 the level sits fourteen bars in,
 * with the earlier 755.42 high above it for context.
 *
 * Simulated with a 2R target over the 21 bars the window leaves:
 *
 *   stop inside the level   752.57   0.42× ATR total   −1.00R at +1 bar
 *   stop 0.15 ATR beyond    753.53   1.08× ATR         +2.00R at +12 bars
 *   stop 0.60 ATR beyond    754.18   1.53× ATR         +4.48R at +14 bars
 *   stop 2.50 ATR beyond    756.93   3.43× ATR         +2.00R at +14 bars
 *
 * **Only the lower bound has teeth here**, which is the mirror of 5.B where only the upper
 * one did. Every stop placed beyond the level reaches the target; the move ran far enough
 * that width cost nothing. So the tolerance is generous above and strict below, because that
 * is what this window punishes — and copying another boss's numbers instead is how 5.B
 * nearly shipped wrong.
 *
 * **SPY-1h is derived, not fetched.** SPY's daily series stops in 2023 and its fifteen-minute
 * snapshot starts in 2026, so no period covers both; the hourly pane is resampled from the
 * fifteen by `lib/data/resample.ts`, which reproduces a known daily series exactly on the one
 * pair where that can be checked.
 */
export const level: Level<"replay-trade"> = {
  id: "6-2",
  chapter: 6,
  title: "The level is upstairs",
  kind: "replay-trade",
  brief:
    "Two panes, both running. The hourly chart above is where price turned before; the fifteen-minute chart below is where you act. Play forward, and when price comes back to that hourly high and rejects it, take the short.",
  data: [
    { series: "SPY-15m", from: 758, to: 840, label: "SPY · 15m — the trade" },
    { series: "SPY-1h", from: 160, to: 194, label: "SPY · 1h — the level, for context only" },
  ],
  config: {
    prompt:
      "Play forward. When price retests the hourly level, place your stop and target, say why, and let it run.",
    side: "short",
    primeBars: 61,
    maxBars: 21,
    minRR: 2,
    atrPeriod: 14,
  },
  target: {
    structure: { shape: "level", price: 753.31 },
    triggerBar: 818,
  },
  // Measured on this window rather than copied. Inside the level a retest takes the stop out
  // on the next bar; beyond it, every width from 0.1 to 2.5 ATR reached the target, so the
  // upper bound is set where the window stops being informative rather than where it starts
  // punishing — it never does.
  tolerance: { minAtr: 0.1, maxAtr: 2.5, barSlop: 2 },
  stars: [0.4, 0.7, 0.9],
  misconceptions: [
    {
      id: "mtf-stop-inside-the-level",
      test: (attempt, lvl) => {
        const structure = lvl.target.structure;
        if (structure.shape !== "level") return false;
        return attempt.stop < structure.price;
      },
      message:
        "Your stop is below the hourly high the whole idea rests on. A retest is allowed to touch the level — that is what makes it a retest — so a stop inside it gets taken out by the ordinary case. On this window it died to the very next bar, on a move that disproved nothing.",
    },
    {
      id: "mtf-no-target",
      test: (attempt) => attempt.target === null,
      message:
        "No target. The level tells you where you are wrong, which fixes your risk; without a number on the other side there is nothing to compare that risk against, and 'I will see how it goes' is how a two-to-one becomes a break-even.",
    },
    {
      id: "mtf-ignored-the-hourly-pane",
      test: (attempt) => attempt.reason.trim().length < 20,
      message:
        "Whatever you wrote, the reason this trade exists is on the other chart. The fifteen-minute bar is a trigger, not an argument — on its own it is one of hundreds in this window. What makes it worth acting on is the hourly high it happened at, and Chapter 9 reads these reasons back to you.",
    },
  ],
  hints: [
    "Find the high on the hourly pane that price failed at earlier, then wait for the fifteen to come back to it.",
    "Your stop belongs on the far side of the hourly level, not inside the bar that triggered.",
  ],
};
