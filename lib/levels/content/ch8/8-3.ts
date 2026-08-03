import type { Level } from "../../schema";

/**
 * The ranking the player earned, and what it was worth.
 *
 * `CURRICULUM.md` lists 8.3 among the levels that exist "specifically to teach the player to
 * distrust their own results". It was specified as "one setup, six assets, six outcomes" — some
 * work, some don't. Measured, that is not what happens: the breakout rule is **profitable on
 * all six**. So the level became the one the curriculum's own integrity note asked for instead.
 *
 * ## The two orderings
 *
 * Trend persistence, variance ratio at 90 bars — the table the player built in 8.2:
 *
 *   BTCUSDT 1.413   AAPL 1.086   GC 0.771   SPY 0.667   EURUSD 0.658   LAKE 0.580
 *
 * The same breakout rule's per-trade R, on the same six:
 *
 *   AAPL +0.522   GC +0.328   BTCUSDT +0.300   SPY +0.215   LAKE +0.115   EURUSD +0.010
 *
 * **Three things fall out, and the third is the level.**
 *
 * The rankings are *close*: Spearman's rho is 0.771. Measuring persistence was not a waste.
 *
 * But the top is inverted. The most persistent market is **third** most profitable, and the
 * most profitable market is second on persistence. A player who concluded from 8.2 that
 * Bitcoin is the market to trade breakouts in would have picked the third-best of six.
 *
 * And with six markets, **none of it is significant.** At n = 6 a Spearman rho needs about
 * 0.83 for p < 0.05, so 0.771 does not clear it; the persistence gaps do not clear |z| = 2
 * either, bar the index's short horizons. The player will have done the measurement correctly,
 * reasoned from it correctly, and still cannot claim the relationship exists. That is the
 * lesson, and Chapter 4 already built the habit it rests on.
 *
 * ## Why persistence is the ranked quantity
 *
 * `AUTHORING.md` requires the ranked quantity be inferable: "one that can only be guessed is a
 * lottery with a correction screen." The profit ordering is not inferable — nothing the game
 * has taught predicts Apple first and gold second. Persistence is, because the player measured
 * it themselves one level earlier. So the ranking is answerable and the *reveal* is the part
 * that refuses to cooperate, which is 4.5's shape exactly.
 *
 * `swaps: 2` is generous and deliberately so. Only one adjacent gap is genuinely
 * indistinguishable on the point estimates — SPY at 0.667 against the euro at 0.658 — but
 * since no gap in the table clears |z| = 2, forgiving a second keeps the level about the shape
 * of the ordering rather than about recalling six decimals.
 *
 * `data: []`, so all six markets can appear in the reveal while Apple stays reserved for the
 * boss. Apple is *why* the reserve matters: it tops the profit table, and a player who leaves
 * this chapter thinking persistence is what pays meets it again at the boss.
 */
export const level: Level<"sort-rank"> = {
  id: "8-3",
  chapter: 8,
  title: "The ranking that does not pay",
  kind: "sort-rank",
  brief:
    "You measured which of these markets keeps going and which snaps back. Now put them in order from most trend-persistent to least — you have the numbers, this is not a guess. Then we will trade the identical breakout rule on all six and see how much your ordering was worth.",
  data: [],
  config: {
    prompt:
      "Order the six markets by trend persistence, most persistent first. The variance ratios you measured are the answer.",
    topLabel: "keeps going",
    bottomLabel: "snaps back",
    items: [
      { id: "gold", label: "Gold", note: "Ratio 0.771 at ninety bars, z −1.1." },
      {
        id: "bitcoin",
        label: "Bitcoin",
        note: "Ratio 1.413 — the only market above one, and the only one that crosses. z 1.7, so still not distinguishable from a coin flip.",
      },
      { id: "euro", label: "Euro", note: "Ratio 0.658, z −1.0." },
      {
        id: "smallcap",
        label: "Small-cap",
        note: "Ratio 0.580 — the most mean-reverting of the six. z −1.5.",
      },
      {
        id: "apple",
        label: "Apple",
        note: "Ratio 1.086, z 0.4. Second, and about to matter more than that.",
      },
      {
        id: "index",
        label: "S&P 500",
        note: "Ratio 0.667, z −1.1 at ninety bars — but significant at two through nine, the only effect in the spine that survives a robust test.",
      },
    ],
    reveal: "breakout-by-market",
  },
  // The measured order at 90 bars. Recomputed from the committed artefact in the claims test,
  // so a change to the estimator fails there rather than making a level quietly wrong.
  target: { order: ["bitcoin", "apple", "gold", "index", "euro", "smallcap"] },
  tolerance: { swaps: 2 },
  stars: [0.5, 0.75, 0.95],
  misconceptions: [
    {
      id: "rank-put-volatility-first",
      test: (attempt) => attempt.order[0] === "smallcap",
      message:
        "The small-cap is the most volatile market here after Bitcoin and the most mean-reverting of all six — a ratio of 0.580, further below one than anything else. Big daily moves and persistent moves are different properties, and 8.1 was the level that separated them: size is what you divide by, direction is what you are measuring.",
    },
    {
      id: "rank-trusted-the-order-it-earned",
      test: () => false,
      message:
        "Your ordering was right, and the reveal shows what it bought: the rankings agree at a Spearman rho of 0.771, which sounds convincing and, with six markets, needs about 0.83 to clear the usual bar. The market you correctly put first is third on profit, and Apple — second on persistence — pays most. You measured well and still cannot claim the relationship. Six is a small sample, which Chapter 4 spent a chapter establishing.",
    },
    {
      id: "rank-expected-the-rule-to-fail-somewhere",
      test: () => false,
      message:
        "It did not. The identical rule made money on all six markets, which was not the plan for this level — the spec expected some to work and some not. What it actually does is spread fiftyfold per trade, from +0.522R on Apple to +0.010R on the euro. On the euro, over 69 trades, that is indistinguishable from not having traded.",
    },
  ],
  hints: [
    "Only one market's ratio is above one. That is the top of the list.",
    "The most mean-reverting market goes last: look for the ratio furthest below one.",
  ],
};
