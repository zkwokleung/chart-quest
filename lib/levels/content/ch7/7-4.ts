import type { Level } from "../../schema";

/**
 * BTCUSDT-1d 473-554, trigger bar 533 (2019-02-01).
 *
 * The same trade, and the only decision is where the stop goes. Entry 3462.07, with a swing low at
 * **3349.92** — 1.01 ATR below, ATR(14) being 110.72.
 *
 * **Chosen for a robust band rather than a lucky one.** Total risk from entry, in ATR, simulated
 * over the 20 bars the window leaves with a 2R target:
 *
 *   0.30x  −1.00R      1.05x  +2.00R      2.25x  +2.00R
 *   0.50x  −1.00R      1.25x  +2.00R      2.50x  +2.00R
 *   0.70x  −1.00R      1.75x  +2.00R      2.60x  +1.65R (ran out of bars)
 *   0.80x  −1.00R      2.00x  +2.00R      3.00x  +1.43R (ran out of bars)
 *
 * So the tolerance band is measured rather than chosen: 1.05x clears the low, and 2.50x is the
 * last width that still reaches its target inside the window.
 *
 * **What actually happened, which is not what this level first claimed.** The docstring used to
 * say every stop inside the low lost and every stop beyond it won. That is false between 0.81x
 * and 1.01x, and the reason is worth more than the tidy version: **price never retested the low
 * at all.** The deepest bar of the next 20 bottomed at 3373.10 on 2019-02-08 — 23.18 dollars
 * *above* the swing low, 0.80x ATR below entry. Every stop with 0.81x of room or more survived,
 * whether or not it was beyond the structure, because the structure was never reached.
 *
 * That is the honest lesson and a better one: placing the stop beyond the low was not rewarded
 * because the low held, it was rewarded because it bought enough room to sit through a pullback
 * that stopped short of it. You cannot know in advance which of those you are getting, which is
 * exactly why the rule is about room rather than about outcomes.
 *
 * The first candidate for this level was BTCUSDT bar 482, where a stop 0.15 ATR beyond the low
 * lost and 0.25 beyond won — a 0.1-ATR gap between −1R and +2R. That is a coin flip dressed as a
 * lesson, and a level built on it would be teaching luck.
 */
export const level: Level<"replay-trade"> = {
  id: "7-4",
  chapter: 7,
  title: "Where the stop belongs",
  kind: "replay-trade",
  brief:
    "Bitcoin, early 2019, at a low it has already turned at once. The entry is not the question and neither is the target — the only decision here is how far away the stop goes, and there is a wrong answer.",
  data: [{ series: "BTCUSDT-1d", from: 473, to: 554, label: "BTCUSDT · daily" }],
  config: {
    prompt: "Place your stop and target, say why, and let it run.",
    side: "long",
    primeBars: 61,
    maxBars: 20,
    minRR: 2,
    atrPeriod: 14,
  },
  target: {
    structure: { shape: "level", price: 3349.92 },
    triggerBar: 533,
  },
  // **Total risk from entry, in ATR** — the units `measurePlan` measures in. The swing low sits
  // 1.01x below entry, so 1.05x is the first width that clears it, and 2.5x is the last that
  // still reaches its 2R target inside the window; 2.6x runs out of bars at +1.65R.
  tolerance: { minAtr: 1.05, maxAtr: 2.5, barSlop: 2 },
  stars: [0.4, 0.7, 0.9],
  misconceptions: [
    {
      id: "stop-inside-the-structure",
      test: (attempt, lvl) => {
        const structure = lvl.target.structure;
        if (structure.shape !== "level") return false;
        return attempt.stop > structure.price;
      },
      message:
        "Your stop sits above the low the trade is built on, so price only has to retest what it already held to take you out. Here it did not: the next twenty bars bottomed 23 dollars above that low, so a stop anywhere below 0.81 ATR survived whether or not it cleared the structure. Being forgiven is not being right — you were holding a stop that a normal retest would have taken, and this time there was not one. A stop is not a budget you choose; it is a price that would prove you wrong.",
    },
    {
      id: "stop-tight-to-feel-safe",
      test: (attempt, lvl, data) => {
        const series = data[0];
        const entry = series?.c[lvl.target.triggerBar];
        if (entry === undefined) return false;
        // Under half an ATR of risk on a market whose average day is 3.2%.
        return entry - attempt.stop < 110.72 * 0.5;
      },
      message:
        "Half an average day's range is not room, it is noise. Bitcoin moved 3.2% on a typical day in this window, so a stop that close is hit by nothing happening — and being stopped out by nothing happening is the most expensive way to be right about direction.",
    },
    {
      id: "stop-no-reason-given",
      test: (attempt) => attempt.reason.trim().length < 15,
      message:
        "Write down why this stop and not another. Chapter 9 reads these back to you and asks whether your stated reasons predicted your results — and 'it felt about right' is not a reason a later chapter can test.",
    },
  ],
  hints: [
    "Find the low price already turned at, then ask what putting the stop above it would mean.",
    "The stop's job is to be wrong, not to be small.",
  ],
};
