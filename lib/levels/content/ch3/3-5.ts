import { barMark } from "../../mark";
import type { Level } from "../../schema";

/**
 * SPY-1d 2425-2830 (2014-08-21 to 2016-03-11), the SPY 200 battle.
 *
 * Measured, and the number is the level: across these nineteen months **twenty-six
 * separate days traded below 200 and closed back above it**. Not two or three — a
 * day a month, for a year and a half, price dipped under the round number and came
 * back.
 *
 * The four targets are the deepest of those probes: bars 2442, 2507, 2537 and 2694,
 * pushing 1.50 to 2.14 below 200 before closing above. They are 30 to 157 bars apart,
 * so they are distinguishable by eye, and `barSlop: 2` covers the immediate
 * neighbours without accepting a different probe entirely.
 *
 * The lesson is not "round numbers are magic". It is that everyone puts their stop
 * just under the obvious number, so that is where price goes to find them — which is
 * the argument boss 3.B then makes with the player's own money.
 */
export const level: Level<"mark-bars"> = {
  id: "3-5",
  chapter: 3,
  title: "Where the stops are",
  kind: "mark-bars",
  brief:
    "SPY spent nineteen months arguing about 200. Click the four days price pushed furthest below it and still closed above.",
  data: [{ series: "SPY-1d", from: 2425, to: 2830, label: "SPY · daily" }],
  config: {
    prompt: "Click the four deepest dips below 200 that closed back above it.",
    mode: "bars",
    expected: 4,
  },
  target: {
    marks: [barMark(2442), barMark(2507), barMark(2537), barMark(2694)],
  },
  tolerance: { barSlop: 2 },
  stars: [0.45, 0.7, 0.9],
  misconceptions: [
    {
      id: "stops-marked-closes-below",
      test: (attempt, lvl, data) => {
        const series = data[0];
        if (!series) return false;
        return attempt.marks.some((mark) => {
          const bar = Number(mark.replace("bar:", ""));
          const close = series.c[bar];
          return close !== undefined && close < 200;
        });
      },
      message:
        "That day closed below 200, so it was not a probe — it was a breakdown, at least for a while. The bars that matter here dipped under and closed back above: price went looking for stops and then left.",
    },
    {
      id: "stops-only-one-visit",
      test: (attempt) => {
        const bars = attempt.marks
          .map((mark) => Number(mark.replace("bar:", "")))
          .sort((a, b) => a - b);
        if (bars.length < 2) return bars.length > 0;
        // Everything inside a single visit to the level rather than spread across it.
        return (bars.at(-1) ?? 0) - (bars[0] ?? 0) < 40;
      },
      message:
        "All of those are the same argument, a few days apart. This happened twenty-six times over nineteen months — the point is how long a round number keeps pulling price back, not how busy one week was.",
    },
  ],
  hints: [
    "You are looking for wicks through 200, not closes through it.",
    "One is in September 2014, two are in the winter of 2014-15, and one is in September 2015.",
  ],
};
