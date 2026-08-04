import type { Level } from "../../schema";

/**
 * The held-back data, and the thing it is not big enough to tell you.
 *
 * ## The level the measurement rewrote
 *
 * `CURRICULUM.md`: "out-of-sample on data held back and revealed only now — **must not collapse**". The
 * plan for M10 measured whether that objective could be met, and it cannot, because the holdback cannot
 * produce a sample to judge it on. Sequential breakout, 2 ATR stop, 2R target, on the committed
 * holdback:
 *
 *   GC-1d-oos 33 trades at its most generous lookback   EURUSD-1h-oos 31   BTCUSDT-4h-oos 23
 *   AAPL-1d-oos 22   SPY-1d-oos 21   LAKE-1d-oos 19   EURUSD-1d-oos 14   BTCUSDT-1d-oos 12
 *
 * Against 39 to 166 in-sample. And the *reference strategy* — the one that beat doing nothing on 134
 * trades across three markets — produces **nine trades on the index, three on gold and nine on
 * Bitcoin's four-hour series**, going negative on the index against a baseline that made +0.34R.
 *
 * A player who has just spent seven levels learning that eighteen examples cannot distinguish a pattern
 * from a coin cannot then be told that nine trades validated their strategy. So the level does not ask
 * whether the strategy survived. It asks **what a sample this size can do**, and the answer is
 * asymmetric: it can refute and it cannot confirm. Nine trades going badly is not proof the rule is
 * broken; nine trades going well is not evidence of anything at all.
 *
 * That asymmetry is the bridge from Chapter 9 to the end of the game, and it is the honest form of "must
 * not collapse" — you can be told you were wrong. You cannot be told you were right.
 *
 * ## Why a `classify` rather than a `build-rules`
 *
 * The holdback is loaded by `HoldbackRun`, a component, and the graded question is the reading. Building
 * it as a `build-rules` level would have required naming `-oos` slices in `level.data`, which means
 * widening `LevelSlice.series` from `SeriesId` to include `OosSeriesId` — destroying the compile-time
 * half of the holdback guarantee across every level in the game to serve this one. `DATA.md` calls that
 * one of three layers and it is the only one that cannot be forgotten. It survived.
 *
 * The graded answer is author-known for every possible player, which is what makes it gradeable at all:
 * no strategy composable from this palette can produce thirty out-of-sample trades on these windows.
 */
export const level: Level<"classify"> = {
  id: "10-6",
  chapter: 10,
  title: "What the held-back data can tell you",
  kind: "classify",
  brief:
    "Above is your own strategy, run on bars that have been kept out of every chapter of this game since the data was committed. Nothing you tuned could have touched them. Look at the trade counts before you look at anything else, and then say what this run is capable of telling you.",
  data: [],
  config: {
    prompt: "What can a result on this much held-back data establish?",
    artefact: "holdback-run",
    options: [
      {
        id: "can-refute-not-confirm",
        label:
          "It can tell me the strategy is broken. It cannot tell me the strategy works — there are not enough trades for that.",
        note: "Correct, and it is the same answer for every player, because no rule you could build from this palette produces thirty trades on these windows. A bad result over nine trades is a warning worth heeding; a good one is not evidence.",
      },
      {
        id: "validated",
        label:
          "If it made money here, the strategy is validated — this is the out-of-sample test, and it passed it.",
        note: "This is the sentence the whole game was built to stop you writing. Nine trades. 9.B's second report quoted a 66.7% win rate from eighteen examples and you marked it as not following; this is the same claim with your own name on it.",
      },
      {
        id: "worthless",
        label:
          "Nothing either way — a sample this small is noise, so the held-back data was not worth keeping.",
        note: "Too far the other way, and it throws away the one thing the holdback does give you. A rule that loses badly on data it has never seen has been refuted, and being able to be refuted is the most a backtest ever offers.",
      },
      {
        id: "needs-more-markets",
        label: "It would establish something if I ran it on more markets at once.",
        note: "More markets is more trades and it is not more independence — 8.4 measured what happens to correlations in the worst decile: Bitcoin against the index goes from 0.01 on an ordinary day to 0.46 on the days that matter. Pooling six correlated markets does not give you six times the sample.",
      },
    ],
  },
  target: { correct: ["can-refute-not-confirm"] },
  tolerance: {},
  stars: [0.5, 0.9, 1],
  misconceptions: [
    {
      id: "ch10-6-validated",
      test: (attempt) => attempt.selected.includes("validated"),
      message:
        "Count the trades. The holdback is the most recent 15% of each series — around 813 daily bars — and a rule selective enough to have an edge fires perhaps nine times in it. The reference strategy for this chapter, which beat doing nothing over 134 in-sample trades, produces nine trades on the index, three on gold and nine on Bitcoin. You spent Chapter 9 learning to ask for the sample size before the figure, and 9.B's under-sampled report was eighteen examples. This is nine, and it is yours, which is the only reason it feels different.",
    },
    {
      id: "ch10-6-worthless",
      test: (attempt) => attempt.selected.includes("worthless"),
      message:
        "Closer to right than the confident answer, and it gives away the one thing that survives. Falsification is asymmetric: it takes a great deal of evidence to establish that something works and very little to establish that it does not. A strategy that loses on nine trades it has never seen has not been proven broken, but you have learned something real — which is more than a strategy that made money on nine trades taught you.",
    },
    {
      id: "ch10-6-the-asymmetry",
      test: () => false,
      message:
        "This is the last idea the game has to give you, so it is worth stating plainly. Every backtest you will ever read, including your own, is a claim about a sample. The in-sample part is where you looked, so it cannot be evidence — you chose it. The out-of-sample part is evidence, and on any honest holdback there is never very much of it. That leaves you able to rule things out and unable to rule things in, permanently, and the traders who survive are the ones who plan for that rather than the ones who find a bigger backtest.",
    },
  ],
  hints: [
    "Look at the n column first, before the expectancy column. That is the habit Chapter 9 was for.",
    "Ask the two questions separately: could this run tell me I am wrong? Could it tell me I am right?",
  ],
};
