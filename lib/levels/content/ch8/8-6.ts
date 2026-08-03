import type { Level } from "../../schema";

/**
 * Which of four rules survives being moved, and the one that cannot be moved at all.
 *
 * The specified level was "match 4 edges to the assets they survive on", which implies a
 * one-to-one mapping. **There is not one.** Apple is the best market for three of the four
 * edges, so any attempt to pair them up has three answers pointing at the same column. What the
 * measurement supports instead is a ranking by *portability* — how many markets a rule survives
 * — which is the question a player actually faces when they leave this game with one rule and a
 * different market in front of them.
 *
 * Measured, positive per-trade R on markets that had setups at all:
 *
 *   breakout     6 of 6 markets   worst +0.010   mean +0.248
 *   three down   5 of 6           worst −0.066   mean +0.209
 *   pullback     4 of 6           worst −0.216   mean +0.080
 *   gap fill     3 of **5**       worst −0.112   mean +0.120
 *
 * **The five is the level.** `gap-fill` has no setups on Bitcoin at all — not a weak result, an
 * absent one, because a market trading every hour of every day never opens below yesterday's
 * low. Zero trades in 2,778 bars. It is the only claim in the chapter with no sample size
 * attached to it, and no amount of further data could overturn it: the rule is not unprofitable
 * on crypto, it is undefined there. Everything else in Chapter 8 is a statistic with an interval
 * round it; this is a fact about how a market works.
 *
 * That is also why `gap-fill` ranks last despite a mean above the pullback's. A rule that cannot
 * be expressed in a whole asset class has failed the portability test before its numbers are
 * consulted, and the ranking is by portability.
 *
 * ## Inferability
 *
 * `AUTHORING.md` requires the ranked quantity be inferable. It is, from things the chapter has
 * already established: a player who has met 1.6's gaps and 8.2's persistence table can reason
 * that a gap rule cannot exist on a 24/7 market and that a breakout is the least
 * market-specific of the four. `swaps: 1` forgives the middle pair, whose means are 0.209
 * against 0.080 but whose market counts differ by only one.
 *
 * `data: []`, so the reveal can show all six markets while Apple stays reserved for the boss —
 * and Apple is the reason the reserve matters here, since it tops three of these four rows.
 */
export const level: Level<"sort-rank"> = {
  id: "8-6",
  chapter: 8,
  title: "The edge that cannot travel",
  kind: "sort-rank",
  brief:
    "You leave here with rules, and you will point them at markets this game never showed you. So the question is not which rule made the most — it is which one still works when you move it. Four rules, six markets, same stop and same target. Rank them by how well they travel.",
  data: [],
  config: {
    prompt:
      "Order these four rules by how many markets they survive in, most portable first.",
    topLabel: "travels",
    bottomLabel: "does not",
    items: [
      {
        id: "pullback",
        label: "Pullback to the average",
        note: "Positive on 4 of 6. Loses on the small-cap at −0.216R a trade, the worst cell in the whole grid.",
      },
      {
        id: "gap-fill",
        label: "Gap up from a gap down",
        note: "Positive on 3 of the 5 markets that have gaps at all. On Bitcoin it has no setups whatsoever — a market that never closes cannot gap.",
      },
      {
        id: "breakout",
        label: "Breakout of the 20-bar high",
        note: "Positive on 6 of 6. Its worst market is the euro at +0.010R, which is barely anything and is still not a loss.",
      },
      {
        id: "three-down",
        label: "Three down days in an uptrend",
        note: "Positive on 5 of 6, losing only on the small-cap, and at −0.066R rather than badly.",
      },
    ],
    reveal: "edge-by-market",
  },
  // The measured portability order: markets survived first, then the worst cell as a tiebreak.
  // Recomputed in the claims test from the committed artefact.
  target: { order: ["breakout", "three-down", "pullback", "gap-fill"] },
  tolerance: { swaps: 1 },
  stars: [0.5, 0.75, 0.95],
  misconceptions: [
    {
      id: "portability-ranked-by-profit",
      test: (attempt) => attempt.order[0] === "gap-fill",
      message:
        "Gap fill has the second-best average of the four, so on profit it ranks well. It also cannot be traded at all in an entire asset class: zero setups on Bitcoin across 2,778 bars, because a market open every hour never opens below yesterday's low. A rule you cannot express in a market has not performed badly there — it does not exist there, and that is a harder limit than a bad number.",
    },
    {
      id: "portability-put-the-pullback-first",
      test: (attempt) => attempt.order[0] === "pullback",
      message:
        "The pullback is the least portable of the three that work everywhere: positive on four of six, and its worst cell — the small-cap at −0.216R a trade — is the worst number in the grid. It needs a market that trends smoothly enough for an average to mean something, which is a demand on the market rather than on the trader.",
    },
    {
      id: "portability-missed-the-structural-zero",
      test: (attempt) => attempt.order[3] !== "gap-fill",
      message:
        "Look at the Bitcoin column for gap fill in the reveal: not a small number, not a negative one — none. This is the cleanest piece of asset character in the chapter and the only one with no sample size attached, so no further data could soften it. Every other claim you have met here is a statistic with an interval round it. This is a fact about how a market is built.",
    },
  ],
  hints: [
    "One of these four cannot be traded in one of the six markets at all. That one goes last.",
    "Of the three that can, count the markets each is actually profitable in.",
  ],
};
