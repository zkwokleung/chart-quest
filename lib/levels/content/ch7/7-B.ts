import { runSequence } from "../../kinds/trade-sequence/grade";
import type { Level } from "../../schema";

/**
 * Boss: GC-1d, ten trades between October 2005 and June 2007.
 *
 * Gold, which no Chapter 7 level teaches on — 7.4 is Bitcoin, 7.5 the euro, 7.6 and 7.7 are SPY,
 * and 7.1 to 7.3 name no series at all because sizing is arithmetic over a contract spec. The
 * cross-asset rule holds without needing to keep gold out of 7.3, which is the level that most
 * needs it.
 *
 * The ten setups, each the chapter's rule with a structural stop and a 2R target, taken in sequence
 * with no overlapping positions. Their outcomes:
 *
 *   −1.00, +2.37, +2.00, −1.00, −1.00, +2.00, +2.39, +2.00, +2.00, −1.21   =  +8.6R
 *
 * Six winners, two consecutive losses in the middle, and a loss at the end so the sequence cannot
 * be read as a victory lap. The last one loses −1.21R rather than −1.00: gold gapped through the
 * stop, which is 1.6's lesson arriving in the last trade of the chapter.
 *
 * **The player's only decision is size, and that is deliberate.** Four bosses already test finding a
 * setup and placing a stop. What none of them tests is deciding how much to risk, ten times, while
 * the account moves underneath — which is the whole of Chapter 7.
 *
 * ## Why a +8.6R sequence makes the point better than a losing one
 *
 * Run at each risk level, from 25,000:
 *
 *   0.5%   26,083   +4.3%
 *   1%     27,191   +8.8%
 *   2%     29,483   +17.9%
 *   5%     36,931   +47.7%
 *   10%    50,944   +103.8%
 *
 * **The reckless player finishes with double the money and scores worse.** That is the lesson the
 * chapter has been building to, and a losing sequence would have let a player conclude that
 * caution is just what wins — rather than that sizing is a decision whose quality is independent of
 * the run it happens to meet. 7.6 already showed what ten percent does to a streak that goes the
 * other way; this shows that the same choice was wrong even when it paid.
 *
 * So the score is process, not profit: survival, restraint, and never raising risk after a loss.
 * See `kinds/trade-sequence/grade.ts` for why "scored on expectancy" cannot mean what it sounds
 * like when the outcomes are already fixed.
 */
export const level: Level<"trade-sequence"> = {
  id: "7-B",
  chapter: 7,
  title: "Ten trades",
  kind: "trade-sequence",
  brief:
    "Gold, twenty months, ten trades. The setups are found and the stops are placed — every one of them is the rule you have been trading all chapter. You decide one thing per trade: how much of the account rides on it. You start with 25,000.",
  data: [{ series: "GC-1d", from: 180, to: 660, label: "GC · daily" }],
  config: {
    prompt:
      "Ten trades, in order. Choose what fraction of the account to risk on each — you will see how it went before the next one.",
    equity: 25_000,
    maxBars: 60,
    // A tenth of a percent through a tenth of the account: enough range that the reckless choices
    // are genuinely available, because a level that only offers sane options teaches nothing.
    riskChoices: [0.005, 0.01, 0.02, 0.05, 0.1],
    trades: [
      { bar: 202, stop: 459.24, targetR: 2, label: "Trade 1 · Oct 2005" },
      { bar: 238, stop: 488.1, targetR: 2, label: "Trade 2 · Dec 2005" },
      { bar: 284, stop: 532.97, targetR: 2, label: "Trade 3 · Feb 2006" },
      { bar: 355, stop: 616.12, targetR: 2, label: "Trade 4 · Jun 2006" },
      { bar: 390, stop: 609.61, targetR: 2, label: "Trade 5 · Jul 2006" },
      { bar: 490, stop: 615.45, targetR: 2, label: "Trade 6 · Dec 2006" },
      { bar: 541, stop: 637.91, targetR: 2, label: "Trade 7 · Mar 2007" },
      { bar: 560, stop: 655.29, targetR: 2, label: "Trade 8 · Apr 2007" },
      { bar: 601, stop: 654.89, targetR: 2, label: "Trade 9 · May 2007" },
      { bar: 612, stop: 649.62, targetR: 2, label: "Trade 10 · Jun 2007" },
    ],
  },
  target: {},
  // Two percent is the defensible ceiling: 7.6 measured that thirteen losses at 2% leaves 76.9% of
  // the account and needs 30% back, which is survivable, while 5% leaves half and needs 95%.
  //
  // The ruin line is deliberately generous at 40%. This sequence makes money at every size on
  // offer, so nothing here trips it — survival is the component that would have carried the score
  // on 7.6's streak, and leaving it in place is what makes the two levels the same lesson.
  tolerance: { maxRiskPct: 0.02, ruinBelow: 0.4 },
  stars: [0.5, 0.75, 0.95],
  misconceptions: [
    {
      id: "boss7-sized-for-the-outcome",
      test: (attempt, lvl) =>
        attempt.risks.some((risk) => risk > lvl.tolerance.maxRiskPct + 1e-9),
      message:
        "This sequence made 8.6R, so risking ten percent a trade doubled the account — and it was still the wrong decision. Run the same ten percent into 7.6's thirteen losses and you finish with a quarter of the money needing a triple to recover. You cannot know which sequence you are in when you size trade one. That is the entire reason a cap exists.",
    },
    {
      id: "boss7-martingale",
      // Recomputed through `runSequence` rather than read off the grade, so the diagnosis does
      // not depend on the scorer having run — and so it means what the message says. An earlier
      // version fired on *any* increase, including after a win, which is the one case the
      // grader is careful to exclude: raising after a winner is not the martingale.
      test: (attempt, lvl, data) =>
        runSequence(attempt, lvl, data).escalations.length > 0,
      message:
        "Somewhere in there you raised your risk after a trade went against you. It is the most human thing in trading and the most expensive: it needs the losing run to end before the money does, and 7.6's ran thirteen deep. The size of the next trade should not depend on the result of the last one — that is what makes it a rule rather than a mood.",
    },
    {
      id: "boss7-risked-almost-nothing",
      test: (attempt) => attempt.risks.every((risk) => risk <= 0.005 + 1e-9),
      message:
        "Half a percent throughout survives anything and earns 4.3% across twenty months of a rule that made 8.6R. There is a floor under caution too: risk so small that a good sequence barely registers is a decision not to participate, and the chapter is about sizing a position rather than avoiding one.",
    },
  ],
  hints: [],
};
