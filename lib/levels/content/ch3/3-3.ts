import { barMark } from "../../mark";
import type { Level } from "../../schema";

/**
 * SPY-1d 1100-1160, target bar 1135 (2009-07-08).
 *
 * A real break of 87.65 — a level visited four times before it went — and then the
 * pullback that tested it from above. Twenty bars after the break price was 14%
 * higher, so this is the break that meant something rather than one that failed.
 *
 * The retest is a **cluster**, not a bar: 1134 through 1138 all dip into the level
 * and close above it. Bar 1135 is the deepest, trading to 87.00 — through the level
 * — and closing back at 88.00. `barSlop: 2` is set because the honest answer is
 * "any of these", and pretending one bar is uniquely correct would be marking a
 * player wrong for reading the chart properly.
 */
export const level: Level<"mark-bars"> = {
  id: "3-3",
  chapter: 3,
  title: "The retest",
  kind: "mark-bars",
  brief:
    "SPY broke 87.65 in July 2009 after four visits, then came back to it. Click the bar that tested the level and held.",
  data: [{ series: "SPY-1d", from: 1100, to: 1160, label: "SPY · daily" }],
  config: {
    prompt:
      "Click the bar that came back to the broken level and closed above it.",
    mode: "bars",
    expected: 1,
  },
  target: { marks: [barMark(1135)] },
  tolerance: { barSlop: 2 },
  stars: [0.5, 0.75, 0.95],
  misconceptions: [
    {
      id: "retest-marked-the-break",
      test: (attempt) =>
        attempt.marks.some((mark) => {
          const bar = Number(mark.replace("bar:", ""));
          // The break itself, days before the pullback.
          return bar >= 1122 && bar <= 1131;
        }),
      message:
        "That is the break, not the retest. The break is where price left the level; the retest is where it came back to see whether the level had changed sides. Only the second one gives you a place to buy with a stop that means something.",
    },
    {
      id: "retest-marked-the-continuation",
      test: (attempt) =>
        attempt.marks.some((mark) => {
          const bar = Number(mark.replace("bar:", ""));
          // After the retest held and price had already run.
          return bar >= 1140;
        }),
      message:
        "By then price had already left. That bar tells you the retest worked, which is only useful in hindsight — the test is the bar that touched the level while the outcome was still unknown.",
    },
  ],
  hints: [
    "Find where price left the level, then look for where it came back.",
    "It is the bar whose low pushes furthest back through 87.65 while the close stays above.",
  ],
};
