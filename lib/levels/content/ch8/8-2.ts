import type { Level } from "../../schema";

/**
 * **The level that makes asset character measured rather than asserted**, and the one whose
 * premise the data changed most.
 *
 * The curriculum asked for "crypto persists; the index reverts — you didn't take this on
 * faith". Measured, that sentence is wrong at the horizon a player would start at and right at
 * the one they have to drag to. Bitcoin's variance ratio over its full history:
 *
 *   horizon    2     3     5    10    20    40    60    90
 *   ratio   0.95  0.96  0.98  1.02  1.10  1.19  1.30  1.41
 *
 * Two of the six cross upward at all, and the gap between them is the interesting part:
 * Bitcoin at **6.1 bars**, Apple not until **20.5**. Gold touches 1.000 at two bars and falls
 * away from there, which is not a crossing. The index, the euro and the small-cap never reach
 * one at any horizon.
 *
 * At two days Bitcoin **mean-reverts** — its lag-1 return autocorrelation is −0.052. It crosses
 * 1.0 at **6.1 bars**, interpolated, and climbs from there. So the honest lesson is not that
 * crypto trends; it is that **trend is a property of a horizon, not of a market**, and the same
 * market answers the question differently depending on how far ahead you ask. A player who
 * never moves the control learns the opposite of the truth, which is why the commit button
 * refuses until they have swept.
 *
 * **And then the second correction, which is bigger.** Those ratios are point estimates. With
 * Lo–MacKinlay's heteroskedasticity-robust z, Bitcoin is not distinguishable from a random walk
 * at *any* horizon — its strongest reading is z = 1.7 at ninety bars. The only effect in the
 * whole spine that survives the test is the index's short-horizon reversion, significant across
 * q = 2 through q = 9. Volatility clustering explains most of the rest.
 *
 * So the readout shows the z beside every ratio, and the chapter says plainly that the tidy
 * picture is mostly not significant. `CURRICULUM.md` already lists 8.3 among the levels that
 * exist "specifically to teach the player to distrust their own results" — the data has handed
 * this chapter that lesson one level earlier than planned, and refusing it would make a chapter
 * about measurement into a chapter about assertion.
 *
 * **Graded on the crossing, not the ranking.** A ranking can be guessed; a crossing cannot be
 * found without moving the control. Slop of 2 covers the interpolated crossing wherever it
 * lands in the single-digit days.
 *
 * `data: []` — a variance ratio is a property of thousands of bars at once, and drawing any one
 * window of them would invite answering by eye, which is the habit this chapter replaces. It
 * also keeps all six markets available to the readout while Apple stays reserved for the boss.
 */
export const level: Level<"probe"> = {
  id: "8-2",
  chapter: 8,
  title: "Measure it yourself",
  kind: "probe",
  brief:
    "Everyone will tell you crypto trends and the index snaps back. Nobody tells you over what period, and that turns out to be the whole question. Below is a variance ratio: above one, moves tend to continue; below one, they cancel; one is a coin flip with a drift. Drag the horizon and watch Bitcoin change its answer — then read the column next to it, which says how much of what you are seeing to believe.",
  data: [],
  config: {
    prompt:
      "Move the horizon until Bitcoin's ratio crosses 1.0. Over how many bars does it stop reverting and start continuing?",
    measure: "variance-ratio",
    label: "horizon, in bars",
    // The artefact's own grid. An interpolated variance ratio is a number nobody measured, so
    // the control may only rest where the measurement exists — asserted in the claims test.
    min: 2,
    max: 90,
    step: 1,
    initial: 2,
    assets: [
      "BTCUSDT-1d",
      "SPY-1d",
      "AAPL-1d",
      "EURUSD-1d",
      "GC-1d",
      "LAKE-1d",
    ],
    focus: "BTCUSDT-1d",
    scoring: "target",
    // Starting at 2 and answering near 6 covers almost none of the range, so the requirement
    // is what forces the sweep — and the long climb to 1.41 is half the lesson.
    exploreFraction: 0.6,
  },
  // Derived from the committed measurements, not authored: `crossingHorizon` puts the
  // interpolated crossing at 6.09, and the claims test recomputes it and fails if it moves.
  target: { value: 6 },
  tolerance: { slop: 2 },
  stars: [0.4, 0.7, 0.9],
  misconceptions: [
    {
      id: "probe-answered-from-the-short-end",
      test: (attempt) => attempt.value <= 3,
      message:
        "At two or three bars Bitcoin's ratio is *below* one — it reverts, like everything else here. That is the finding worth keeping: the market everyone calls trend-following does not trend day to day. Keep dragging: the ratio crosses one just past six bars and keeps climbing to 1.41 by ninety.",
    },
    {
      id: "probe-answered-from-the-far-end",
      test: (attempt) => attempt.value >= 40,
      message:
        "By forty bars Bitcoin is well above one — the question was where it *crosses*, which is much earlier. Worth noticing on the way back: only one other market crosses at all, and not until twenty bars, while three never reach one at any horizon. Where a market crosses is a fact about it, not just whether.",
    },
    {
      id: "probe-believed-the-bars",
      test: () => false,
      message:
        "Read the z column before you trust the picture. Under two in absolute value means the market is not distinguishable from a coin flip at that horizon — and Bitcoin never clears it, not even at 1.41. The only thing in this table that survives a robust test is the index reverting over two to nine bars. The ratios are real measurements and most of them are not evidence, which is a distinction worth more than the ranking.",
    },
  ],
  hints: [
    "Start at the left, where the ratio is below one, and drag right until it passes it.",
    "Only one market crosses in the single-digit days. One more does much later; three never do.",
  ],
};
