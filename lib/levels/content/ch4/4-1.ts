import { barMark } from "../../mark";
import type { Level } from "../../schema";

/**
 * BTCUSDT-1d 685-725 (2019-07-03 to 2019-08-11).
 *
 * Six bars in forty carry one of the three patterns, by `findPatterns`:
 *
 *   692  bullish engulfing
 *   707  bullish pin bar
 *   708  bullish pin bar
 *   710  bullish pin bar
 *   720  bullish engulfing
 *   721  bullish pin bar and a doji
 *
 * **The window was chosen for its near misses, not its hits.** Fourteen other bars
 * fail one threshold narrowly — a body a fraction over a third of the range, a wick a
 * fraction under sixty percent — so "click everything that looks dramatic" scores
 * badly and reading the rule scores well. A window where the patterns were the only
 * interesting bars would teach nothing, because there would be nothing to discriminate.
 *
 * Bar 721 is both a pin bar and a doji: its body is under a tenth of its range and its
 * lower wick is over sixty percent. That overlap is real rather than a defect in the
 * definitions, and 4.5 is where the player finds out neither label was worth much.
 */
export const level: Level<"mark-bars"> = {
  id: "4-1",
  chapter: 4,
  title: "Three shapes, and the rules that make them",
  kind: "mark-bars",
  brief:
    "A pin bar has a small body and one long wick — price went somewhere and came back. A doji has almost no body at all. An engulfing bar's body swallows the one before it. Six bars here qualify. Most of the rest nearly do.",
  data: [{ series: "BTCUSDT-1d", from: 685, to: 725, label: "BTCUSDT · daily" }],
  config: {
    prompt:
      "Mark every bar that completes a pin bar, a doji or an engulfing pattern.",
    mode: "bars",
    expected: 6,
  },
  target: {
    marks: [
      barMark(692),
      barMark(707),
      barMark(708),
      barMark(710),
      barMark(720),
      barMark(721),
    ],
  },
  // One bar, as every other bar-marking level uses. Slop is here for the pointing:
  // clicking a candle is imprecise and a mis-click is not a misreading.
  //
  // It does mean a mark at 709 satisfies either 708 or 710, because these patterns
  // cluster — the conditions that produce one pin bar produce another two days later,
  // and no 40-bar window in either spine asset holds all three kinds without a pair
  // landing within three bars. Zero slop was the first choice for that reason and it
  // made the level brittle rather than strict: the perturbation sweep showed a uniform
  // one-bar shift scoring nothing at all, which is not what "off by one click" deserves.
  tolerance: { barSlop: 1 },
  stars: [0.5, 0.7, 0.9],
  misconceptions: [
    {
      id: "pattern-marked-the-big-bars",
      test: (attempt, level, data) => {
        const series = data[0];
        const slice = level.data[0];
        if (!series || !slice) return false;
        const ranges: number[] = [];
        for (let i = slice.from; i < slice.to; i += 1) {
          ranges.push((series.h[i] ?? 0) - (series.l[i] ?? 0));
        }
        const big = [...ranges].sort((a, b) => b - a)[Math.floor(ranges.length / 4)] ?? 0;
        const marked = attempt.marks.map((m) => Number(m.replace("bar:", "")));
        if (marked.length === 0) return false;
        const wide = marked.filter(
          (bar) => (series.h[bar] ?? 0) - (series.l[bar] ?? 0) >= big,
        );
        return wide.length / marked.length > 0.6;
      },
      message:
        "You marked the dramatic bars. Size is not one of the three rules: a pin bar is about the *proportions* of a bar — body against range, wick against range — so a quiet little candle can be a textbook one and a huge candle can be nothing at all.",
    },
    {
      id: "pattern-marked-too-many",
      test: (attempt) => attempt.marks.length > 10,
      message:
        "More than ten, in a window that holds six. Fourteen bars here miss by a fraction — a body just over a third of the range, a wick just under sixty percent — and a definition that catches everything catches nothing. The near misses are the point of this window.",
    },
    {
      id: "pattern-missed-the-doji",
      test: (attempt) =>
        !attempt.marks.includes(barMark(721)) && attempt.marks.length >= 3,
      message:
        "Bar 721 is the one worth going back to: its body is under a tenth of its range *and* its lower wick is over sixty percent, so it is a doji and a pin bar at the same time. The categories overlap, which is a hint about how much they are really telling you.",
    },
  ],
  hints: [
    "Compare each bar's body against its whole high-to-low range, not against its neighbours.",
    "An engulfing bar has to be the opposite colour to the one it swallows.",
  ],
};
