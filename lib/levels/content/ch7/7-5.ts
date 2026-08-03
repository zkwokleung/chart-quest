import type { Level } from "../../schema";

/**
 * The win rate a reward:risk ratio demands, and the six markets that fall either side of it.
 *
 * **`classify`, not `tune-param`.** CURRICULUM.md asks for a slider. `TuneParam`'s component is
 * built around an indicator drawn on a chart — its config *is* `(value) => IndicatorSpec` — and a
 * required-win-rate curve is not an indicator. Bending the kind to draw an abstract curve would
 * make it two kinds wearing one name, so the question is asked directly and the arithmetic goes in
 * the notes.
 *
 * The arithmetic needs no data: breaking even at a reward:risk of `rr` needs `1/(1+rr)`. Fifty
 * percent at 1:1, forty at 1.5:1, **33.3% at 2:1**, twenty-five at 3:1.
 *
 * What makes it land is measured. The same mechanical rule from Chapter 6 — a bullish reversal
 * candle at a prior swing low, stop below that low, target at twice the risk — traded
 * sequentially with no overlapping positions:
 *
 *   GC      46.3% hit rate   108 trades   +43.47R
 *   AAPL    43.1%            102          +34.99R
 *   SPY     42.6%            101          +33.10R
 *   BTC     31.6%             76           +0.01R
 *   LAKE    30.3%            155           −7.48R
 *   EURUSD  25.3%            178          −34.41R
 *
 * The line is where the money stops. Every market above 33.3% made between 33 and 43R; both
 * markets clearly below it lost. **Bitcoin is the boundary case and lands on it almost exactly** —
 * 1.7 points under the line, and +0.01R across 76 trades. Not "roughly break-even": break-even to
 * within a hundredth of an R. It is the closest thing to a demonstration this dataset can offer
 * that the formula is describing something real rather than being asserted.
 *
 * **These are not Chapter 6's numbers and the level says so.** 6.4 reported 24–28% for the same
 * rule because it counted *every* qualifying bar, overlaps included. This counts a sequence a
 * trader could actually have taken, entering only when flat. Both are honest and they answer
 * different questions — a reader meeting both without explanation would think one is wrong.
 */
export const level: Level<"classify"> = {
  id: "7-5",
  chapter: 7,
  title: "The win rate your target demands",
  kind: "classify",
  brief:
    "Euro against the dollar, and the rule you have been trading all chapter: a reversal candle at a level, a stop beyond it, a target at twice the risk. On this market that rule wins a quarter of the time. Is a quarter enough?",
  data: [{ series: "EURUSD-1d", from: 1200, to: 1600, label: "EURUSD · daily" }],
  config: {
    prompt:
      "At two-to-one, winning 25% of the time — what does that make the strategy?",
    options: [
      {
        id: "loses",
        label:
          "A loser. Two-to-one needs 33.3% to break even, so a quarter is well short of it.",
        note: "Correct, and measured: this rule made −34.4R on the euro across 178 trades.",
      },
      {
        id: "wins-because-2-to-1",
        label:
          "A winner — you make two when right and lose one when wrong, so one win covers two losses.",
        note: "One win covers two losses, and at 25% you get three losses per win. That is the whole of the arithmetic.",
      },
      {
        id: "breakeven",
        label: "About break-even. A quarter of two is a half, which is what you lose.",
      },
      {
        id: "need-more-data",
        label: "Unknowable — 178 trades is too few to say.",
      },
    ],
  },
  target: { correct: ["loses"] },
  tolerance: {},
  stars: [0.5, 0.9, 1],
  misconceptions: [
    {
      id: "rr-confused-ratio-with-edge",
      test: (attempt) => attempt.selected.includes("wins-because-2-to-1"),
      message:
        "One win does cover two losses — and at a 25% hit rate you get three losses for every win, so you are one loss short every time round. The break-even win rate is 1/(1+RR): 33.3% at two-to-one. Below it a good ratio just loses money more slowly. Measured on this exact rule, the euro gave 25% and −34.4R while gold gave 46% and +43.5R.",
    },
    {
      id: "rr-averaged-the-payoff",
      test: (attempt) => attempt.selected.includes("breakeven"),
      message:
        "A quarter of two is 0.5, and the three-quarters of the time you lose costs 0.75 — so the expectancy is −0.25R a trade, not zero. Break-even needs the win rate where those two products are equal, which is 1/(1+RR) and comes to a third.",
    },
    {
      id: "rr-hid-behind-sample-size",
      test: (attempt) => attempt.selected.includes("need-more-data"),
      message:
        "Chapter 4 was right that a small sample says little, and 178 trades is not a small sample — it is the largest count of any market in the spine. The interval around 25% does not reach 33%, and the total is −34.4R rather than ambiguous. Doubting a measurement is a habit worth having and it needs a reason each time.",
    },
  ],
  hints: [
    "Work out the expectancy: 0.25 winners paying two, against 0.75 losers costing one.",
    "There is a formula for the break-even win rate, and it depends only on the ratio.",
  ],
};
