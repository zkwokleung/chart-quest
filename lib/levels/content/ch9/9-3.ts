import type { Level } from "../../schema";

/**
 * How far a winning rule falls on the way to winning.
 *
 * ## The specified kind cannot hold
 *
 * `CURRICULUM.md` lists 9.3 as `predict-next`, whose attempt is `calls: (Direction | null)[]` —
 * a sequence of up-or-down calls. A drawdown is a magnitude, and there is no honest way to ask
 * for one with a direction picker. So it is a `probe` whose control *is* the guess.
 *
 * The spec also says "+40%/yr equity curve". There is no equity curve here to have a percentage
 * of: these trades come from a rule measured in R over eight levels' worth of notional accounts,
 * and quoting an annual return would be inventing an account to divide by. The
 * brief-percentage guard would reject a fabricated figure anyway. So the question is in R, and
 * the readout says why.
 *
 * ## The measurement
 *
 * Apple's best in-sample lookback — the tidiest curve of the four markets 9.5 sweeps:
 *
 *   +51.7R over 116 trades, and a 8.2R drawdown on the way. 16% of everything it made.
 *
 * And for contrast once revealed: gold gave back 30% of its total at its worst point, the index
 * 37%, Bitcoin 25%. **Apple is the gentlest of the four**, which is the point — a player who
 * guesses low on the best-behaved curve in the set has understated every other one too.
 *
 * Target 8.2 with a slop of 2.5, which is generous on purpose. The lesson is the order of
 * magnitude, not the decimal: a player who guesses 2R has a wrong model of what a good year
 * feels like, and one who guesses 7R has the right one.
 *
 * ## It shares 9.5's artefact
 *
 * The sweep already walks every lookback's R curve to compute its drawdowns, so one script and
 * one committed file serve both levels — and the numbers here are literally the ones the player
 * will tune two levels later, which is worth more than two unrelated tables.
 */
export const level: Level<"probe"> = {
  id: "9-3",
  chapter: 9,
  title: "How deep does a good year get",
  kind: "probe",
  brief:
    "Here is a rule that worked: a hundred and sixteen trades, fifty-one and a half R of profit, on the best-behaved of the four markets we will look at. Before you see the rest — how much of that profit do you think it handed back at its worst stretch? Answer in R, then commit.",
  data: [],
  config: {
    prompt:
      "At its worst point, how far did this curve fall from its own high? Answer in R.",
    measure: "drawdown",
    label: "your guess, in R",
    min: 0,
    max: 25,
    step: 0.5,
    initial: 0,
    // Read for the measurement, displayed nowhere — the readout draws a derived R curve rather
    // than any market's price chart, which is what keeps these outside the boss guard.
    assets: ["AAPL-1d", "GC-1d", "SPY-1d", "BTCUSDT-1d"],
    focus: "AAPL-1d",
    scoring: "target",
    // A guess is one number, so there is no sweep to require. The control starts at zero and
    // the player has to move it to answer at all.
    exploreFraction: 0.01,
    revealOnCommit: true,
  },
  // Derived from the committed sweep: Apple's best in-sample lookback drew down 8.2R. The
  // chapter's claims test recomputes it and fails if the artefact moves.
  target: { value: 8 },
  tolerance: { slop: 2.5 },
  stars: [0.4, 0.7, 0.9],
  misconceptions: [
    {
      id: "drawdown-guessed-too-shallow",
      test: (attempt) => attempt.value < 4,
      message:
        "Too shallow, and it is the ordinary mistake. This curve gave back 8.2R at its worst — a sixth of everything it made — and it is the *gentlest* of the four markets in this chapter. Gold gave back 30% of its total, the index 37%. A rule you would describe as working spends much of its life below its own high-water mark.",
    },
    {
      id: "drawdown-guessed-far-too-deep",
      test: (attempt) => attempt.value > 20,
      message:
        "Deeper than this curve managed: 8.2R against a 51.7R total. Worth keeping the instinct, though — you have the right idea about which direction people get this wrong in, and Chapter 7's thirteen-loss streak is what that instinct is for.",
    },
    {
      id: "drawdown-is-in-r-not-percent",
      test: () => false,
      message:
        "The answer is in R rather than in percent, and that is not pedantry. These trades come from one rule measured across four markets with no shared account, so a percentage would be a percentage of a number nobody chose. R is what the whole game has measured in since Chapter 3, and it is the only unit here that means anything.",
    },
  ],
  hints: [
    "A rule that makes fifty R does not make it in a straight line.",
    "Think about the worst run of losses in Chapter 7, and what a handful of those in a row costs.",
  ],
};
