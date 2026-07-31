import type { Level } from "../../schema";

/**
 * The chapter's payload. No chart: the subject is the evidence, not a window.
 *
 * **The question the curriculum specified cannot be asked honestly.** CURRICULUM.md
 * has the player rank five patterns by win rate, then discover the rates are lower
 * and more asset-dependent than they guessed. Measured with the shipped detector over
 * five markets, the pooled rates are:
 *
 *   doji                50.1%   n=2309   [48.0, 52.1]
 *   head and shoulders  50.0%   n=66     [38.3, 61.7]
 *   engulfing           48.5%   n=1843   [46.2, 50.7]
 *   pin bar             48.4%   n=3733   [46.8, 50.0]
 *   double top          47.6%   n=332    [42.3, 53.0]
 *
 * Two and a half points separate best from worst, and every interval overlaps every
 * other. **There is no ordering there to be right about**, which is exactly the fault
 * docs/AUTHORING.md warns about — a metric almost constant across the answer space —
 * and it sank three levels in earlier chapters before it was named.
 *
 * So the ranking is by **how much evidence there is**, which does separate: 3,733
 * down to 66, a 57x span, with intervals from 3.2 to 23.5 points wide. It is also
 * inferable rather than guessable, from the rules 4.1 taught: a pin bar allows a body
 * up to a third of its range and a doji only a tenth, so pin bars must be commoner;
 * an engulfing needs two bars to line up; a double top needs three swings and a head
 * and shoulders five. Restrictiveness predicts rarity, and the player has everything
 * needed to work it out.
 *
 * Then the reveal does the teaching. The ordering they just derived is the ordering of
 * *confidence*, and along the other axis nothing moves at all. Head and shoulders —
 * rarest, most storied, and the one whose 26.7% on gold and 66.7% on LAKE come from
 * fifteen and eighteen examples — carries an interval seven times the width of the pin
 * bar's. The most impressive-looking number in the table is the one with the least
 * behind it.
 *
 * The ranking is stored like every attempt, so Chapter 9 can hand it back.
 */
export const level: Level<"sort-rank"> = {
  id: "4-5",
  chapter: 4,
  title: "How much do we actually know?",
  kind: "sort-rank",
  brief:
    "Five patterns, and one honest question about them. Not which works best — put them in order of how often they occur, from commonest to rarest. You have the rules for all five, and the rules are enough to work it out.",
  // No chart. This level's subject is the accumulated evidence across five markets and
  // eighteen years, which no single window can show.
  data: [],
  config: {
    prompt:
      "Order the five patterns by how often they appear. Use the rules, not a hunch: the tighter a definition, the fewer bars can satisfy it.",
    topLabel: "commonest",
    bottomLabel: "rarest",
    reveal: "pattern-base-rates",
    items: [
      {
        id: "doji",
        label: "Doji",
        note: "body under a tenth of the bar's range",
      },
      {
        id: "head-and-shoulders",
        label: "Head and shoulders",
        note: "three swing highs, the middle one clear of the others",
      },
      {
        id: "pin-bar",
        label: "Pin bar",
        note: "body under a third of the range, one wick over sixty percent",
      },
      {
        id: "double-top",
        label: "Double top",
        note: "two swing highs within 2%, a trough 3% below",
      },
      {
        id: "engulfing",
        label: "Engulfing",
        note: "a body swallowing the opposite-coloured one before it",
      },
    ],
  },
  target: {
    order: ["pin-bar", "doji", "engulfing", "double-top", "head-and-shoulders"],
  },
  // Two transpositions. The three candlesticks sit within a factor of two of each
  // other and their order, while derivable, is the fine detail; the split between
  // common candles and rare chart patterns is the part that matters, and muddling
  // that costs more swaps than the tolerance covers.
  tolerance: { swaps: 2 },
  stars: [0.45, 0.7, 0.9],
  misconceptions: [
    {
      id: "rates-ranked-chart-patterns-first",
      test: (attempt) => {
        const rank = (id: string) => attempt.order.indexOf(id);
        return (
          rank("double-top") < rank("engulfing") ||
          rank("head-and-shoulders") < rank("engulfing")
        );
      },
      message:
        "You have a chart pattern above a candlestick one. Count what each definition needs: an engulfing bar needs two adjacent bars to line up, while a double top needs two swing highs within 2% of each other *and* a trough 3% below *and* the four bars after the second peak to stay under it. Every extra condition divides the number of places it can happen.",
    },
    {
      id: "rates-head-and-shoulders-not-last",
      test: (attempt) => attempt.order.at(-1) !== "head-and-shoulders",
      message:
        "The rarest of the five is the head and shoulders — five swings, with the middle high clear of two others that are level with each other. It occurs 66 times in eighteen years across five markets, which is worth remembering when you next see one described as reliable.",
    },
    {
      id: "rates-guessed-by-fame",
      test: (attempt) => {
        // Famous shapes first is the intuitive-but-wrong ordering: the chart patterns
        // people can name are the ones there are almost none of.
        const rank = (id: string) => attempt.order.indexOf(id);
        return rank("head-and-shoulders") <= 1 || rank("double-top") <= 1;
      },
      message:
        "You put a named shape near the top. The patterns with names and reputations are the rare ones — that is *why* they have names, since a shape you see twice a week does not need one. It also means they are the ones nobody has enough examples of to know anything about.",
    },
  ],
  hints: [
    "Rank the three single-or-double candle patterns above the two made of swings.",
    "Between a pin bar and a doji: one allows a body up to a third of the range, the other a tenth. Which rule can more bars satisfy?",
  ],
};
