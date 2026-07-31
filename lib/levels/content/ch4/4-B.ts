import { barMark } from "../../mark";
import type { Level } from "../../schema";

/**
 * Boss: LAKE-1d 4394-4465, trigger bar 4427 (2022-08-04).
 *
 * **Not EURUSD 1h, and the data decided that.** CURRICULUM.md specifies the boss on
 * hourly euro, and the series will not carry it. `EURUSD-1h` holds 1,295 pin bars in
 * 7,163 bars — a fifth of every 130-bar window qualifies — so "scan the chart and find
 * the setup" has no answer a grader could defend. It contains **zero** double tops and
 * zero head-and-shoulders at any span, so the chapter's own chart patterns are not
 * available either. Searching it for a discriminating trade turned up sixteen, and the
 * best of them were bars where the feed reports open exactly equal to close.
 *
 * `LAKE-1d` was chosen instead: an illiquid small cap running a 3.70% daily ATR, which
 * no chapter has taught on, and where a chart pattern is rare enough to be findable.
 * The cross-asset guard is satisfied — Chapter 4 teaches on BTCUSDT-1d and AAPL-1d.
 *
 * The setup is the only chart pattern in the window:
 *
 *   4416  first top   high 16.43   (2022-07-20)
 *   4418  trough      low  15.39
 *   4423  second top  high 16.46   (2022-07-29)
 *   4427  confirmed, entry at the close of 15.32
 *
 * Tops 0.18% apart, trough 6.3% below, ATR(14) 0.5671. Simulated through `simulate`,
 * with a 2R target and the structure at the second top's high of 16.46:
 *
 *   stop on the top          16.46   2.01x ATR   +2.00R at +23 bars
 *   stop just above it       16.57   2.21x ATR   +2.15R at +25 bars
 *   stop 1 ATR above         17.03   3.01x ATR   +2.00R at +26 bars
 *   stop 2 ATR above         17.59   4.01x ATR   +1.58R, target never reached
 *   stop inside the pattern  15.83   0.90x ATR   −1.00R at +7 bars
 *
 * So this window punishes both ends, unlike 5.B where only excess width had teeth. A
 * stop inside the pattern dies in a week to a bounce that disproves nothing; a stop
 * more than about 1.4 ATR above the structure pushes the 2R target past anything the
 * window travels. The tolerance is set from those two numbers.
 *
 * **The trade worked, and 4.5 says these are a coin flip.** Both are true and the
 * boss's closing note says so: the point of the chapter is not that the shape pays but
 * that the arithmetic has to survive it not paying.
 */
export const level: Level<"composite"> = {
  id: "4-B",
  chapter: 4,
  title: "Find it, then trade it",
  kind: "composite",
  brief:
    "A small industrial stock you have not seen, moving 3.7% on an average day. One pattern from this chapter is in here. Find where it completed, say what it entitles you to, and take the trade.",
  data: [{ series: "LAKE-1d", from: 4394, to: 4465, label: "LAKE · daily" }],
  config: {
    steps: [
      {
        kind: "mark-bars",
        weight: 0.25,
        brief: "Find where the pattern completed",
        config: {
          prompt:
            "One double top completed in this window. Click the bar of its second peak.",
          mode: "bars",
          expected: 1,
        },
        target: { marks: [barMark(4423)] },
        tolerance: { barSlop: 1 },
        misconceptions: [
          {
            id: "boss4-marked-the-first-top",
            test: (attempt) =>
              attempt.marks.some((mark) => {
                const bar = Number(mark.replace("bar:", ""));
                return bar >= 4414 && bar <= 4417;
              }),
            message:
              "That is the first peak. A double top is not a pattern until the second peak fails at the same place — until then it is one high, and one high is not a pattern at all.",
          },
          {
            id: "boss4-marked-the-breakdown",
            test: (attempt) =>
              attempt.marks.some(
                (mark) => Number(mark.replace("bar:", "")) > 4432,
              ),
            message:
              "Too late. You are marking the move rather than the pattern that preceded it — and by then the entry this level is about has already gone.",
          },
        ],
      },
      {
        kind: "classify",
        weight: 0.2,
        brief: "Say what it entitles you to",
        config: {
          prompt: "The pattern is complete. What does that give you?",
          options: [
            {
              id: "a-level-to-risk-against",
              label:
                "A price that has now rejected twice — so a place to put a stop where being wrong is unambiguous.",
              note: "Correct. The value is not the forecast, it is knowing exactly what would disprove you.",
            },
            {
              id: "an-edge",
              label: "A better-than-even chance that price falls from here.",
              note: "47.6% over 332 examples, from 4.5. The pattern is not what makes this trade worth taking.",
            },
            {
              id: "a-target",
              label:
                "A measured target: the height of the pattern projected down from the trough.",
            },
          ],
        },
        target: { correct: ["a-level-to-risk-against"] },
        tolerance: {},
        misconceptions: [
          {
            id: "boss4-pattern-as-edge",
            test: (attempt) => attempt.selected.includes("an-edge"),
            message:
              "4.5 measured this exact pattern at 47.6% across 332 examples with an interval from 42.3% to 53.0%. If the trade only works when the shape predicts, it does not work. What the shape gives you is a level so clear that a stop beyond it is cheap.",
          },
          {
            id: "boss4-measured-move",
            test: (attempt) => attempt.selected.includes("a-target"),
            message:
              "The measured move is a convention, not a measurement — nobody in this chapter has shown you a base rate for it. A target you can defend comes from what the market has been paying in ATR terms and from the risk you took, which is Chapter 7.",
          },
        ],
      },
      {
        kind: "replay-trade",
        weight: 0.55,
        brief: "Take the trade",
        config: {
          prompt:
            "Short it. Place your stop and target, say why, and play it out.",
          side: "short",
          primeBars: 34,
          maxBars: 35,
          minRR: 2,
          atrPeriod: 14,
        },
        target: {
          structure: { shape: "level", price: 16.46 },
          triggerBar: 4427,
        },
        // Measured on this window rather than copied. Below 0.15 ATR of room the stop
        // sits inside the pattern and a 7-bar bounce takes it; past 1.4 ATR above the
        // structure the 2R target moves further than the window ever travels.
        tolerance: { minAtr: 0.15, maxAtr: 1.4, barSlop: 2 },
        misconceptions: [
          {
            id: "boss4-stop-inside-the-pattern",
            test: (attempt, lvl) => {
              const structure = lvl.target.structure;
              if (structure.shape !== "level") return false;
              return attempt.stop < structure.price;
            },
            message:
              "Your stop is below the high the whole idea rests on. Price bounced 0.90 ATR off this entry within a week without ever threatening the pattern — a stop inside it was taken out by a move that proved nothing.",
          },
          {
            id: "boss4-stop-too-wide",
            test: (attempt, lvl, data) => {
              const series = data[0];
              const entry = series?.c[lvl.target.triggerBar];
              if (entry === undefined) return false;
              // More than about 3.5 ATR of total risk on a 3.7%-ATR stock.
              return attempt.stop - entry > entry * 0.13;
            },
            message:
              "That is more than 13% of price on a stock whose average day is 3.7%. Your target moves out with your risk, and at that width the two-to-one never arrived inside this window — the trade was over on time rather than on being wrong.",
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
      id: "boss4-incomplete",
      test: (attempt) => attempt.steps.some((step) => step === null),
      message:
        "Some stages are unanswered. All three are weighed, so a skipped stage counts as zero rather than being set aside.",
    },
    {
      id: "boss4-it-worked-this-time",
      test: () => true,
      message:
        "This one paid, and 4.5 measured the pattern at 47.6% over 332 examples — so a trade like this loses about as often as it wins. Nothing you did here depended on it winning: you found a price that had been rejected twice, risked a defined amount against it, and asked for twice that. Run it fifty times and the arithmetic is what decides the outcome, not the shape.",
    },
  ],
  hints: [],
};
