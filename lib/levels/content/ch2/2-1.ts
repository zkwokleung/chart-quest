import { barMark } from "../../mark";
import type { Level } from "../../schema";

/**
 * BTCUSDT-1d 1710-1780 (2022-04-23 to 2022-07-01).
 *
 * Three swing highs at bars 1721, 1748 and 1774, separated by at least 26 bars —
 * the widest separation found anywhere in the series for a three-high window, so
 * they are unmistakable. They also descend, which is the structure the chapter is
 * about.
 */
export const level: Level<"mark-bars"> = {
  id: "2-1",
  chapter: 2,
  title: "Swing highs",
  kind: "mark-bars",
  brief:
    "A swing high is a bar whose high stands above its neighbours on both sides. Three of them structure this decline.",
  data: [{ series: "BTCUSDT-1d", from: 1710, to: 1781, label: "BTCUSDT · daily" }],
  config: { prompt: "Mark the three swing highs.", mode: "bars", expected: 3 },
  target: { marks: [barMark(1721), barMark(1748), barMark(1774)] },
  // Two bars of slack: the point is finding the turn, not the exact candle.
  tolerance: { barSlop: 2 },
  stars: [0.4, 0.7, 0.95],
  misconceptions: [
    {
      id: "marked-the-highest-only",
      test: (attempt) => attempt.marks.length === 1,
      message:
        "That is one of them, and probably the highest. A swing high is local — every bar that stands above its immediate neighbours counts, not just the peak of the whole window.",
    },
    {
      id: "marked-lows",
      test: (attempt, level, data) => {
        const series = data[0];
        const slice = level.data[0];
        if (!series || !slice) return false;
        // A mark sitting nearer a local low than a local high suggests the player
        // read the wrong extreme.
        return attempt.marks.some((m) => {
          const i = Number(m.slice(4));
          const window = [i - 2, i - 1, i, i + 1, i + 2];
          const lows = window.map((j) => series.l[j] ?? Infinity);
          return (series.l[i] ?? Infinity) === Math.min(...lows);
        });
      },
      message:
        "At least one of those is a swing low, not a high. Highs and lows both structure a trend, but this level asks only for the peaks.",
    },
    {
      id: "marked-a-crowd",
      test: (attempt) => attempt.marks.length > 5,
      message:
        "Too many. Precision counts here as much as coverage, and only three bars in this window stand clear of their neighbours by any margin.",
    },
  ],
  hints: [
    "Look for bars whose high is above the two bars either side of them.",
    "There is one near the start, one in the middle, and one near the end.",
  ],
  unlocks: ["crosshair"],
};
