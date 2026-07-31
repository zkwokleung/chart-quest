import type { Level } from "../../schema";

/**
 * EURUSD-1d 4000-4260 (2020-06 to 2021-06), SMA period 5 to 200.
 *
 * **Scored on exploration, because there is no right answer.** A shorter average
 * lags less and whipsaws more; a longer one is smoother and later. That is a
 * trade-off, not a puzzle, and a level awarding stars for finding "the correct
 * period" would be teaching a falsehood in the chapter about not trusting
 * indicators.
 *
 * The measurement behind that decision is in 5.2's file and in CURRICULUM.md: run a
 * moving-average rule across this market and the best period moves between windows
 * and sits within noise of its neighbours. There is nothing here to find, and the
 * honest level says so by scoring whether the player looked.
 */
export const level: Level<"tune-param"> = {
  id: "5-1",
  chapter: 5,
  title: "An average is just smoothed price",
  kind: "tune-param",
  brief:
    "Drag the period and watch the line change character. Short averages hug price and turn with every wobble; long ones stay smooth and arrive late. There is no setting that is simply right — that is the point.",
  data: [
    { series: "EURUSD-1d", from: 4000, to: 4260, label: "EURUSD · daily" },
  ],
  config: {
    prompt:
      "Move the period across its range, then say when you have seen enough.",
    label: "period",
    min: 5,
    max: 200,
    step: 5,
    initial: 20,
    indicator: (value) => ({ kind: "sma", period: value }),
    scoring: "exploration",
    exploreFraction: 0.6,
  },
  target: { value: 0 },
  tolerance: { slop: 0 },
  stars: [0.4, 0.7, 0.95],
  misconceptions: [
    {
      id: "ma-barely-looked",
      test: (attempt) => attempt.visited.length <= 2,
      message:
        "You committed almost without moving it. The lesson here is a thing you have to see happen — the line pulling away from price as the period grows — and it does not survive being described.",
    },
    {
      id: "ma-only-the-short-end",
      test: (attempt) => Math.max(...attempt.visited, 0) < 80,
      message:
        "You stayed at the short end, where the average is barely distinguishable from price. Drag it past a hundred and watch how far behind a turn it arrives — that lag is the price you pay for the smoothness.",
    },
  ],
  hints: [
    "Put it at 5, then at 200, and compare where the line sits after a sharp turn.",
  ],
};
