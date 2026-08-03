import type { Level } from "../../schema";

/**
 * What one R is worth, in money, on three instruments.
 *
 * **`sizing-calc`, not `annotate`.** CURRICULUM.md lists 7.1 as `annotate` — place an entry and
 * a stop and read your R. The annotate grader scores a drawing on whether *price respected it*:
 * touches, body cuts, anchors. A risk band is not a level price turned at, so that grader would
 * be measuring the wrong property of the right shape, and the score would reward drawing the
 * band where price happened to bounce rather than where the stop belongs.
 *
 * So the question is asked directly instead: here is a position and a stop, what does being
 * wrong cost? Which is what 1R *is*.
 *
 * No chart, and no series named. `riskOf` is arithmetic over a contract spec, so there is nothing
 * for a window to add — and it keeps this level out of the cross-asset boss guard, which is what
 * lets 7.3 use gold as its futures example while 7.B runs on gold.
 *
 * The three rows are chosen so the multiplier is the whole difference: 100 shares and one gold
 * contract are both "one position", and one of them risks a hundred times more per dollar of
 * price. Answers come from the formula, not from this file.
 */
export const level: Level<"sizing-calc"> = {
  id: "7-1",
  chapter: 7,
  title: "What one R costs",
  kind: "sizing-calc",
  brief:
    "R is not a percentage and not a number of points. It is the money you lose if the stop is hit — the unit every trade in this game has been measured in since Chapter 3. Here are three positions. Price the risk on each.",
  data: [],
  config: {
    prompt:
      "For each position, how much does the account lose if the stop is hit? Answer in the quote currency.",
    // Not used for `riskCurrency` rows, but the schema carries one account for the level.
    equity: 50_000,
    riskPct: 0.01,
    answer: "riskCurrency",
    positions: [
      {
        instrument: "AAPL-1d",
        entry: 200,
        stop: 196,
        units: 100,
        label: "100 shares of Apple, stop 4 dollars away",
      },
      {
        instrument: "GC-1d",
        entry: 1_900,
        stop: 1_896,
        units: 1,
        label: "One gold contract, stop 4 dollars away",
      },
      {
        instrument: "EURUSD-1d",
        entry: 1.1,
        stop: 1.0996,
        units: 1,
        label: "One euro lot, stop 4 pips away",
      },
    ],
  },
  target: {},
  // Two percent. These are exact sums, so the tolerance is for arithmetic slips rather than for
  // judgement — there is none to exercise here.
  tolerance: { relative: 0.02 },
  stars: [0.5, 0.75, 0.95],
  misconceptions: [
    {
      id: "risk-ignored-the-multiplier",
      test: (attempt) =>
        attempt.values.some((value) => value !== null && Math.abs(value - 4) < 0.5),
      message:
        "Four is the stop *distance*, not the risk. A four-dollar move costs four dollars only if you hold one unit worth one dollar a point. On a gold contract the same four dollars is four hundred, because the contract is a hundred ounces — and that factor is the difference between a 1% loss and a 100% one.",
    },
    {
      id: "risk-priced-the-position-not-the-risk",
      test: (attempt, lvl) =>
        attempt.values.some(
          (value, i) =>
            value !== null &&
            lvl.config.positions[i] !== undefined &&
            Math.abs(value - lvl.config.positions[i]!.entry) < lvl.config.positions[i]!.entry * 0.2,
        ),
      message:
        "That is roughly what the position is worth, not what it risks. The two are unrelated: a large position with a close stop can risk less than a small one with a distant stop, and every sizing decision in this chapter turns on the second number rather than the first.",
    },
    {
      id: "risk-same-answer-everywhere",
      test: (attempt) => {
        const given = attempt.values.filter((v): v is number => v !== null);
        return given.length >= 2 && new Set(given).size === 1;
      },
      message:
        "The same number three times cannot be right, because the three instruments turn a price move into money at three different rates. That rate is the only thing you need to know about an instrument to size a trade in it, and it is the thing 7.3 makes you use four times.",
    },
  ],
  hints: [
    "Risk is the stop distance times what one point is worth times how many units you hold.",
    "Look up what one point is worth on each instrument. Two of the three are not one.",
  ],
};
