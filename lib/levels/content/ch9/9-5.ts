import type { Level } from "../../schema";

/**
 * **The most important level in the game**, per `CURRICULUM.md`, and the one whose measurement
 * came out better than its specification.
 *
 * The player tunes one knob — a breakout's lookback — across four markets, watching only the
 * first seventy percent of each history. Committing reveals the later third.
 *
 * ## What the sweep actually found
 *
 * Order the four markets by how much tuning *appeared* to help in-sample, and you get exactly
 * their order by how badly it let them down later:
 *
 *   SPY   the tuned lookback made 1.94x an average one  ->  ranked 25th of 26 later
 *   GC    1.64x                                         ->  21st
 *   BTC   1.38x                                         ->  13th, the median exactly
 *   AAPL  1.19x                                         ->   3rd
 *
 * Monotone, on four markets. So the lesson is **not** "the optimum collapses" — Apple disproves
 * that, and a level built on gold alone would have swapped one false rule for another. It is
 * that **how excited the in-sample result made you predicts how much it will cost you**, which
 * is a claim about the tuner rather than about the market, and therefore survives its own
 * counter-example.
 *
 * Apple is the case worth sitting with: its in-sample curve is nearly flat, so there was no peak
 * to overfit *to*, and its optimum duly held up. Nothing was tuned, so nothing broke.
 *
 * ## `scoring: "exploration"`, and this is not a detail
 *
 * A `target` would have the game award three stars for finding the overfit parameter and then
 * print "answer: 11" on the correction screen — teaching the exact habit the level exists to
 * break, in the level `CONVENTIONS.md` calls load-bearing. So the score is the sweep: whether
 * the player looked across the range before committing. There is no right lookback, and the
 * level must not pretend otherwise.
 *
 * ## Why it never says "out-of-sample"
 *
 * Chapter 10.6 uses that phrase for `public/data/oos/` — bars the game has never shown anybody —
 * and no Chapter 1-9 level may touch that data. This splits a series Chapters 1-8 already taught
 * on, so calling it out-of-sample would give the game two meanings for its most load-bearing
 * term. It says **"the later third"**, and the brief tells the player Chapter 10 does the real
 * thing.
 *
 * `data: []`: a parameter sweep is a property of thousands of bars across four markets, and
 * drawing any one window would invite answering by eye.
 */
export const level: Level<"probe"> = {
  id: "9-5",
  chapter: 9,
  title: "Tune it until it looks brilliant",
  kind: "probe",
  brief:
    "One rule, one setting: buy when price closes above the highest high of the last n bars, stop two ATR below, target twice the risk. Below is what it made on four markets across the first seventy percent of their history — the part you are allowed to look at. Move the setting until you find the number that works. Then commit, and see the rest.",
  data: [],
  config: {
    prompt:
      "Find the lookback that makes the most across these four markets, then commit. There is no trick in the tuning — the trick is what tuning is.",
    measure: "edge-sweep",
    label: "lookback, in bars",
    // The sweep's own grid: 5 to 55 in twos, twenty-six values. The readout snaps to the
    // nearest measured cell rather than interpolating, because an interpolated total is a
    // number nobody measured.
    min: 5,
    max: 55,
    step: 2,
    initial: 5,
    assets: ["GC-1d", "SPY-1d", "AAPL-1d", "BTCUSDT-1d"],
    focus: "SPY-1d",
    scoring: "exploration",
    // Two thirds of the range. Enough that a player has seen the shape rather than one peak —
    // and the shape is what the reveal then reinterprets.
    exploreFraction: 0.65,
    revealOnCommit: true,
  },
  // Ignored entirely: `scoring: "exploration"` never reads it, and there is no right lookback
  // to put here. Zero rather than a plausible-looking number, so nobody reads this as an answer.
  // 5.1 does the same for the same reason.
  target: { value: 0 },
  tolerance: { slop: 0 },
  stars: [0.4, 0.7, 0.9],
  misconceptions: [
    {
      id: "overfit-took-the-peak",
      test: () => true,
      message:
        "Whatever you settled on, look at the rank column. On the index, the lookback that made the most in the tuning window came 25th of 26 in the later third — twenty-four settings you did not pick beat the one you did. On gold, 21st of 26. That is worse than not tuning at all, and it is the ordinary result rather than the cautionary one.",
    },
    {
      id: "overfit-apple-held-up",
      test: () => true,
      message:
        "Apple did not collapse: its best lookback came 3rd of 26 later. Before you file that as luck, look at why — Apple's tuning-window curve is almost flat, so its best setting made 1.19x an average one against the index's 1.94x. There was no peak to overfit *to*. Nothing was tuned, so nothing broke.",
    },
    {
      id: "overfit-the-real-rule",
      test: () => true,
      message:
        "Line the four markets up by how much tuning seemed to help, and they come out in exactly the order of how badly it hurt: index 1.94x then 25th, gold 1.64x then 21st, Bitcoin 1.38x then 13th, Apple 1.19x then 3rd. So the rule is not 'optimums collapse'. It is that **how pleased the backtest made you is how much it is going to cost you** — which is a fact about you rather than about the market, and the one thing here that will still be true on data nobody has seen.",
    },
  ],
  hints: [
    "Try the extremes before the middle. The shape of the curve matters more than its peak.",
    "Whatever you commit, the question afterwards is not whether you were right — it is how much your confidence was worth.",
  ],
};
