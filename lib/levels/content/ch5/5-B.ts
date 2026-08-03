import { barMark } from "../../mark";
import type { Level } from "../../schema";

/**
 * Boss: SPY-15m 162-312, trigger bar 242 (2026-06-12 15:30).
 *
 * **A composite rather than a bare `replay-trade`, and the data forced it.**
 * CURRICULUM.md lists 5.B's kind as `replay-trade` but describes it as "structure +
 * 2 indicators, entry in replay" — three things, which is a composite. That turned
 * out to matter: SPY-15m is a 1,041-bar rolling snapshot, and searched with 3.B's
 * discriminator (a stop on the swing low fails while one with room reaches 2R) it
 * yields exactly one setup, with 1.32 points of risk. A composite needs a
 * *defensible* trade rather than a knife-edge one, and the series has eight of those.
 *
 * Measured at the trigger, entry 740.96 with ATR(14) 2.768 — 0.374% of price:
 *
 *   stop on the pullback low (735.03)   2.14x ATR   +2.00R at +18 bars
 *   stop a little below it   (733.65)   2.64x ATR   +2.00R at +27 bars
 *   stop 1.5 ATR below it    (733.02)   2.87x ATR   +1.18R, never reaches target
 *
 * The structure is bar **235**, the only fractal low within seven bars of the entry.
 * A first draft used 737.17, a dip during the rally that is not a swing low at all —
 * the content-claims test caught it by checking the bar really is the lowest of its
 * neighbourhood, which is the check 3.B's window needed too.
 *
 * So unlike 3.B the *lower* bound does not discriminate on outcome here — a stop on
 * the low survives — while the upper one does: risk past about 2.8x ATR pushes the
 * 2R target beyond anything the window offers. The tolerance reflects what this data
 * punishes rather than copying 3.B's numbers.
 *
 * A different market from every Chapter 5 level, which teach on EURUSD-1d, BTC-1d
 * and SPY-1d. SPY-15m is a distinct SeriesId, so the cross-asset guard is satisfied
 * — and fifteen-minute bars are genuinely unfamiliar after four chapters of dailies.
 */
export const level: Level<"composite"> = {
  id: "5-B",
  chapter: 5,
  title: "Structure, indicators, and a trade",
  kind: "composite",
  brief:
    "SPY on fifteen-minute bars — a timeframe you have not seen. Read the structure, read what the indicators are and are not telling you, then take the trade.",
  data: [{ series: "SPY-15m", from: 162, to: 312, label: "SPY · 15m" }],
  config: {
    steps: [
      {
        kind: "mark-bars",
        weight: 0.25,
        brief: "Mark the pullback low",
        config: {
          prompt: "Click the bar where the pullback found its low.",
          mode: "bars",
          expected: 1,
        },
        target: { marks: [barMark(235)] },
        tolerance: { barSlop: 1 },
        misconceptions: [
          {
            id: "boss5-marked-the-high",
            test: (attempt, lvl, data) => {
              const series = data[0];
              if (!series) return false;
              return attempt.marks.some((mark) => {
                const bar = Number(mark.replace("bar:", ""));
                const window = [bar - 2, bar - 1, bar, bar + 1, bar + 2];
                const highs = window.map((i) => series.h[i] ?? -Infinity);
                return (series.h[bar] ?? -Infinity) === Math.max(...highs);
              });
            },
            message:
              "That is a local high. The trade rests on where the pullback stopped falling, because that is the level the market would have to break to prove the idea wrong — and therefore the only place a stop means anything.",
          },
          {
            id: "boss5-marked-too-early",
            test: (attempt) =>
              attempt.marks.some(
                (mark) => Number(mark.replace("bar:", "")) < 230,
              ),
            message:
              "Too far back. The pullback that matters is the one immediately before the entry — earlier lows are history the trade is not resting on.",
          },
        ],
      },
      {
        kind: "classify",
        weight: 0.25,
        brief: "Read the indicators",
        config: {
          prompt: "RSI is near 63 here. What does that justify?",
          options: [
            {
              id: "context",
              label:
                "Nothing on its own — it describes the move, it does not predict it.",
              note: "Correct, and it is the same lesson 5.3 paid for: a reading is a description.",
            },
            {
              id: "overbought",
              label: "Caution: it is approaching overbought.",
              note: "63 is not even at the conventional line, and 5.3 showed that 70 held for eighteen days while price rose 21%.",
            },
            {
              id: "buy",
              label: "A buy: momentum is confirmed.",
              note: "Momentum being positive is the same fact as price having risen, restated.",
            },
          ],
        },
        target: { correct: ["context"] },
        tolerance: {},
        misconceptions: [
          {
            id: "boss5-overbought-again",
            test: (attempt) => attempt.selected.includes("overbought"),
            message:
              "Sixty-three is not even at the conventional line, and 5.3 spent a level showing that seventy held for eighteen days while Bitcoin rose 21%. A reading is a description of what has happened.",
          },
          {
            id: "boss5-momentum-as-confirmation",
            test: (attempt) => attempt.selected.includes("buy"),
            message:
              '"Momentum is positive" and "price has gone up" are the same sentence. The indicator adds no fact to the chart you are already looking at, which is 5.6\'s point arriving in a place where it costs money.',
          },
        ],
      },
      {
        kind: "replay-trade",
        weight: 0.5,
        brief: "Take the trade",
        config: {
          prompt:
            "Place your stop and target, say why, then play the replay out.",
          side: "long",
          // a pullback low in a rally.
          setup: "continuation",
          primeBars: 81,
          maxBars: 60,
          minRR: 2,
          atrPeriod: 14,
        },
        target: {
          structure: { shape: "level", price: 735.03 },
          triggerBar: 242,
        },
        // Measured, not copied from 3.B. The structure sits 2.14x ATR below entry,
        // so any stop beyond it is already wide — which is why the lower bound is
        // generous and `beyondStructure` carries the structural half of the lesson.
        // The upper bound is the one with teeth: past about 2.8x ATR the 2R target
        // moves further than this window ever travels.
        tolerance: { minAtr: 0.5, maxAtr: 2.7, barSlop: 2 },
        misconceptions: [
          {
            id: "boss5-stop-above-the-low",
            test: (attempt, lvl) => {
              const structure = lvl.target.structure;
              if (structure.shape !== "level") return false;
              return attempt.stop > structure.price;
            },
            message:
              "Your stop sits above the swing low the trade is built on. Price only has to retrace what it already retraced once to take you out of an idea that has not been disproved.",
          },
          {
            id: "boss5-stop-too-wide",
            test: (attempt, lvl, data) => {
              const series = data[0];
              if (!series) return false;
              const entry = series.c[lvl.target.triggerBar];
              if (entry === undefined) return false;
              return entry - attempt.stop > entry * 0.014;
            },
            message:
              "More than 1.4% on a fifteen-minute chart whose average bar spans 0.37%. Your target moves out with your risk, and at that width the two-to-one never arrives inside the session — the trade was over before it was wrong.",
          },
        ],
      },
    ],
  },
  target: {},
  tolerance: {},
  stars: [0.4, 0.7, 0.9],
  misconceptions: [
    {
      id: "boss5-incomplete",
      test: (attempt) => attempt.steps.some((s) => s === null),
      message:
        "Some stages are unanswered. The boss weighs all three, so a skipped stage counts as zero rather than being set aside.",
    },
    {
      id: "boss5-new-timeframe",
      test: () => true,
      message:
        "These were fifteen-minute bars, and nothing you did here was specific to that. A pullback low, an indicator that describes rather than predicts, and a stop with room — the timeframe changed the numbers and none of the reasoning.",
    },
  ],
  hints: [],
};
