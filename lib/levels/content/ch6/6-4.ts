import type { Level } from "../../schema";

/**
 * Four BTCUSDT-4h setups, ranked by how many confirmations each shows.
 *
 * **The chapter's payload, and the measurement rewrote it twice.**
 *
 * CURRICULUM.md asks for four setups ranked by confluence, revealing that the top-ranked
 * one lost. A single loser is an anecdote, so the first attempt was to measure the whole
 * distribution instead. Counting five confirmations — at support, above the 50-bar average,
 * a bullish reversal candle, RSI under 60, and a daily uptrend — over every 4h bar, with a
 * stop below the last swing low and a 2R target:
 *
 *   5 ticks   n=  22   reached 2R  5%   mean −0.86R
 *   4 ticks   n= 243   reached 2R 16%   mean −0.46R
 *   3 ticks   n=1159   reached 2R 24%   mean −0.21R
 *   2 ticks   n=2009   reached 2R 28%   mean −0.05R
 *
 * Monotone, and pointing the wrong way. But two of those five conditions are an average and
 * an oscillator, and **neither is drawn on these charts** — so the player could not count
 * them, and a ranking task you cannot perform by looking is a lottery. Counting only what
 * price shows — at support, a bullish reversal candle, and higher lows leading in:
 *
 *   3 ticks   n=  59   reached 2R 25%  [16–38]   mean −0.24R
 *   2 ticks   n= 742   reached 2R 24%  [21–27]   mean −0.21R
 *   1 tick    n=2353   reached 2R 28%  [26–30]   mean −0.04R
 *   0 ticks   n=1069   reached 2R 25%  [22–27]   mean −0.15R
 *
 * **Flat.** Every interval overlaps every other across 4,223 setups. Stacking visible
 * confirmations bought nothing — not less, nothing. That is a better level than the one
 * specified, because it rests on four thousand setups rather than on one chosen loser, and
 * it sets up 6.5, which shows *why*: the confirmations are not independent.
 *
 * So the task is to rank the four setups by confirmation count, which is objective and
 * checkable by eye, and the reveal is that the ranking was worth nothing. The four charts
 * are the things being counted; **the claim rests on the aggregate, not on them.** Their own
 * outcomes happen to run −1.00R, −1.00R, −0.27R and +2.00R from most confirmations to
 * fewest, which is the flat distribution doing what a flat distribution does.
 */
export const level: Level<"sort-rank"> = {
  id: "6-4",
  chapter: 6,
  title: "Stacking the deck",
  kind: "sort-rank",
  brief:
    "Four moments on Bitcoin's four-hour chart. Each one is a possible long. Three things a trader would look for: price at a level it has turned at before, a bullish reversal candle, and higher lows leading in. Rank the four by how many of the three they show.",
  data: [
    { series: "BTCUSDT-4h", from: 363, to: 424, label: "A" },
    { series: "BTCUSDT-4h", from: 672, to: 733, label: "B" },
    { series: "BTCUSDT-4h", from: 979, to: 1040, label: "C" },
    { series: "BTCUSDT-4h", from: 1281, to: 1342, label: "D" },
  ],
  config: {
    prompt:
      "Rank them by how many of the three confirmations the last bar of each chart shows.",
    topLabel: "most confirmations",
    bottomLabel: "fewest",
    items: [
      { id: "b", label: "Setup B", slice: 1, note: "at a level, reversal candle" },
      { id: "d", label: "Setup D", slice: 3, note: "none of the three" },
      { id: "a", label: "Setup A", slice: 0, note: "at a level, reversal candle, higher lows" },
      { id: "c", label: "Setup C", slice: 2, note: "at a level" },
    ],
  },
  target: { order: ["a", "b", "c", "d"] },
  // One transposition. The counts are objective, but "is this bar a reversal candle" and
  // "are these higher lows" are judgements made by eye at chart resolution, and B against
  // C is the pair a careful player can reasonably see either way.
  tolerance: { swaps: 1 },
  stars: [0.5, 0.75, 0.95],
  misconceptions: [
    {
      id: "confluence-ranked-it-right",
      test: (attempt) =>
        attempt.order.join(",") === "a,b,c,d" || attempt.order.join(",") === "a,c,b,d",
      message:
        "That is the right ranking, and here is what it was worth. Across 4,223 four-hour setups scored the same way — stop below the last swing low, target at twice the risk — three confirmations reached the target 25% of the time, two 24%, one 28% and none 25%. Every one of those intervals overlaps every other. The confirmations did not make the trades better; they only made them feel better. 6.5 is about why.",
    },
    {
      id: "confluence-put-the-empty-one-first",
      test: (attempt) => attempt.order[0] === "d",
      message:
        "Setup D shows none of the three: its low is not at a prior level, its last bar is not a reversal candle, and the structure leading in is not making higher lows. Whatever you make of what happened next, the count is the count — and counting is the part of this that is objective.",
    },
    {
      id: "confluence-ignored-the-structure-tick",
      test: (attempt) => attempt.order.indexOf("a") > 1,
      message:
        "Setup A is the only one of the four showing all three. If you ranked it lower, check the sequence of lows leading into its last bar — the third confirmation is a structural one, and it is the easiest of the three to read past.",
    },
  ],
  hints: [
    "Take the three confirmations one at a time across all four charts rather than judging each chart as a whole.",
    "Two of the four show a reversal candle at a prior level. What separates them is the structure leading in.",
  ],
};
