import { barMark } from "../../mark";
import type { Level } from "../../schema";

/**
 * BTCUSDT-1d 400-456 (2018-09-21 to 2018-11-16), the head and shoulders before the
 * November 2018 crash.
 *
 * By `findPatterns`, the three components are:
 *
 *   417  left shoulder   high 6715.60  (2018-10-08)
 *   424  head            high 7680.00  (2018-10-15)
 *   447  right shoulder  high 6615.15  (2018-11-07)
 *
 * The head stands 14.4% above the left shoulder; the shoulders are 1.5% apart. It is
 * as clean an example as the series holds.
 *
 * **The window stops at bar 455, four bars past the right shoulder.** That is the
 * first bar at which the pattern is knowable — a swing high is not a swing high until
 * four bars have failed to exceed it — so the player is marking a shape they could
 * actually have seen rather than one hindsight has already outlined.
 *
 * It also means the crash is off the right edge: from the close on bar 451 price fell
 * 27.7% in ten bars, sixteen times the average daily range. The brief does **not** say
 * so. Two reasons, and the second is the one that matters: a level that announces the
 * payoff is asking a much easier question, and a brief quoting a figure that happens
 * outside its own window is the exact fault the authoring guard exists to catch — it
 * failed on this level's first draft.
 *
 * Chosen for clarity rather than for outcome, and this one happens to be the most
 * violent success in the whole dataset. 4.5 is four levels away and reports that these
 * win 50.0% of the time on sixty-six examples. Both facts are true, which is the
 * chapter's argument.
 */
export const level: Level<"mark-bars"> = {
  id: "4-4",
  chapter: 4,
  title: "Two shoulders and a head",
  kind: "mark-bars",
  brief:
    "Bitcoin, autumn 2018. Three rallies: the middle one went highest, and the two either side stopped at about the same place. Mark the peak of each.",
  data: [{ series: "BTCUSDT-1d", from: 400, to: 456, label: "BTCUSDT · daily" }],
  config: {
    prompt: "Mark the three peaks: left shoulder, head, right shoulder.",
    mode: "bars",
    expected: 3,
  },
  target: { marks: [barMark(417), barMark(424), barMark(447)] },
  // One bar either side. The shoulders are broad rallies rather than single spikes,
  // so demanding the exact bar would test pixel accuracy rather than reading.
  tolerance: { barSlop: 1 },
  stars: [0.5, 0.75, 0.95],
  misconceptions: [
    {
      id: "hs-marked-the-lows",
      test: (attempt, level, data) => {
        const series = data[0];
        if (!series) return false;
        return attempt.marks.some((mark) => {
          const bar = Number(mark.replace("bar:", ""));
          const window = [bar - 2, bar - 1, bar, bar + 1, bar + 2];
          const lows = window.map((i) => series.l[i] ?? Infinity);
          return (series.l[bar] ?? Infinity) === Math.min(...lows);
        });
      },
      message:
        "Those are the troughs between the peaks. They matter — the line joining them is the neckline, and breaking it is what completes the pattern — but the three parts this level asks for are the peaks.",
    },
    {
      id: "hs-head-is-not-the-highest",
      test: (attempt, level, data) => {
        const series = data[0];
        if (!series) return false;
        const bars = attempt.marks.map((m) => Number(m.replace("bar:", "")));
        if (bars.length < 3) return false;
        const highs = bars.map((bar) => series.h[bar] ?? 0);
        const highest = Math.max(...highs);
        const middle = highs[1] ?? 0;
        return middle !== highest;
      },
      message:
        "The head has to be the tallest of the three, and in your marks it is not. Without that the shape is just three peaks — which, if they are level with each other, is a range, and if they are rising, is an uptrend.",
    },
    {
      id: "hs-marked-too-few",
      test: (attempt) => attempt.marks.length > 0 && attempt.marks.length < 3,
      message:
        "The pattern is made of three peaks and it is not a pattern with two of them. Two level peaks with a dip between them is a double top, which is the other shape this chapter uses — and the one 4.B asks you to trade.",
    },
  ],
  hints: [
    "The tallest peak is in the middle. Find it first, then look for the smaller one on each side.",
    "The two shoulders should be at roughly the same height as each other.",
  ],
};
