import type { Level } from "../../schema";

/**
 * SPY-1d 448-532, and what a tight trailing stop actually costs.
 *
 * **`classify`, not `replay-trade`.** A replay trade's attempt is an entry, a stop, a target and a
 * reason — there is nowhere in it for the player to say "and trail it". Adding a trail control
 * would be a new interaction on a kind four bosses already depend on, and the measurement below is
 * stronger evidence than one trade anyway.
 *
 * The trade shown: entry at bar 508 (2007-01-10). Held to a 3R target it makes **+3.08R** in
 * nineteen bars. With a stop trailing half an R behind the high from 1R onward it makes **+1.13R**
 * and is out in four, the stop having walked up to 142.86.
 *
 * And the aggregate, which is the actual claim — 720 trades across six assets, same entries and
 * same initial stops, varying only what happens after:
 *
 *   fixed 2R target                 +69.7R   37% positive
 *   trail 1R behind by 0.5R         +41.6R   49% positive
 *   trail 2R behind by 1.0R        +104.2R   37% positive
 *   half off at 1R, rest to 3R      +38.4R   32% positive
 *   half off at 1R, rest trailed    +17.6R   49% positive
 *
 * Three things fall out. A tight trail costs 40% of the return. It *raises* the share of positive
 * trades from 37% to 49% while doing so — it feels better and earns less. And a late, loose trail
 * is the only variant that beats a plain target, by half again.
 *
 * Partials are worse still: taking half off at 1R roughly halves the total, because the winners are
 * what pay for everything and half of every winner has been capped.
 */
export const level: Level<"classify"> = {
  id: "7-7",
  chapter: 7,
  title: "What trailing costs",
  kind: "classify",
  brief:
    "One trade, two ways of managing it. Held to its three-R target it made 3.08R over nineteen days. With a stop trailing half an R behind the high it made 1.13R and was out in four. Across 720 trades the pattern holds — and so does something stranger.",
  data: [{ series: "SPY-1d", from: 448, to: 532, label: "SPY · daily" }],
  config: {
    prompt:
      "A tight trailing stop turned 3.08R into 1.13R here, and cost 40% of the total across 720 trades. What did it buy?",
    options: [
      {
        id: "more-winners",
        label:
          "A higher share of winning trades — 49% instead of 37% — and a lower total. It feels better and earns less.",
        note: "Correct, and it is the whole trap: trailing converts large wins into small ones, which raises the win rate while lowering the sum.",
      },
      {
        id: "protection",
        label:
          "Protection. Locking in gains means fewer winners handed back, which has to be worth something.",
        note: "Fewer handed back and fewer allowed to grow. The measured total falls from +69.7R to +41.6R.",
      },
      {
        id: "nothing",
        label: "Nothing at all — trailing is strictly worse than holding a target.",
        note: "Too strong. Trailing late and loose — from 2R, a full R behind — made +104.2R against +69.7R for the fixed target.",
      },
      {
        id: "smaller-drawdown",
        label: "A smaller worst-case loss on any single trade.",
      },
    ],
  },
  target: { correct: ["more-winners"] },
  tolerance: {},
  stars: [0.5, 0.9, 1],
  misconceptions: [
    {
      id: "trail-called-it-protection",
      test: (attempt) => attempt.selected.includes("protection"),
      message:
        "It does protect, and that is the cost rather than the benefit. A trailing stop cannot tell a pullback from a reversal, so it exits both — and since the large winners are what pay for every loser, cutting them short takes the total from +69.7R to +41.6R while the share of winning trades rises from 37% to 49%. More winners, less money. Those two facts feel contradictory and are the same fact.",
    },
    {
      id: "trail-condemned-it-outright",
      test: (attempt) => attempt.selected.includes("nothing"),
      message:
        "Nearly, but the data does not support the absolute. Trailing *late and loose* — starting at 2R and staying a full R behind — made +104.2R against the fixed target's +69.7R, the best of the eight variants measured. What loses money is trailing tightly and early. The distinction matters because 'never trail' and 'trail carefully' are different rules and only one of them is supported.",
    },
    {
      id: "trail-thought-it-capped-the-loss",
      test: (attempt) => attempt.selected.includes("smaller-drawdown"),
      message:
        "The worst case on a single trade is unchanged: the initial stop sets it, and a trail that only activates once the trade is 1R ahead has not moved by the time a loser is losing. Every variant measured lost the same full R on its losers. What trailing changes is the winners.",
    },
  ],
  hints: [
    "Compare two numbers: the share of trades that made money, and the total made.",
    "Ask what a trailing stop does when price pulls back inside a move that then continues.",
  ],
};
