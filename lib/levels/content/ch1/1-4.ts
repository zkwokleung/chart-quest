import { barMark } from "../../mark";
import type { Level } from "../../schema";

/**
 * SPY-1d bars 2610-2680 — the August 2015 devaluation selloff.
 *
 * The three heaviest bars (2677, 2678, 2679) are consecutive and 1.71x the fourth
 * heaviest, 3.3x the window's median. Picked for that separation: a window where
 * the third and fourth are within a few percent would be unfair, because nobody
 * can tell those apart by eye.
 */
export const level: Level<"mark-bars"> = {
  id: "1-4",
  chapter: 1,
  title: "Where the volume went",
  kind: "mark-bars",
  brief:
    "Volume is the second series on the chart — how much changed hands. Three days here dwarf the rest.",
  // Ends at 2680, not 2681. Bar 2680 is the fourth-heaviest day and only 2% below
  // the third, which would make the top three visually indistinguishable and the
  // level unfair.
  data: [{ series: "SPY-1d", from: 2610, to: 2680, label: "SPY · daily" }],
  config: {
    prompt: "Mark the three highest-volume bars.",
    mode: "bars",
    expected: 3,
  },
  target: { marks: [barMark(2677), barMark(2678), barMark(2679)] },
  // One bar of slack: the three targets are consecutive, and the lesson is
  // finding the cluster, not pixel precision.
  tolerance: { barSlop: 1 },
  stars: [0.4, 0.7, 0.95],
  misconceptions: [
    {
      id: "marked-price-not-volume",
      test: (attempt, level) => {
        const targets = new Set(level.target.marks);
        // Marks well before the volume cluster, where the largest *price* moves
        // of the window sit.
        return attempt.marks.some(
          (m) => !targets.has(m) && Number(m.slice(4)) < 2660,
        );
      },
      message:
        "Those are price moves, not volume. Volume is the histogram in the lower pane — read its height, not the candles above it.",
    },
    {
      id: "marked-too-many",
      test: (attempt) => attempt.marks.length > 5,
      message:
        "Marking a wide band cannot score well: precision counts, so extra marks cost you as much as missing ones. Three bars stand clearly above the rest here.",
    },
    {
      id: "found-only-the-biggest",
      test: (attempt) => attempt.marks.length === 1,
      message:
        "That is one of them. Two more sit right beside it — the heaviest volume in this window arrived as a run of consecutive days, not a single spike.",
    },
  ],
  hints: [
    "Read the lower pane, not the candles.",
    "The heaviest days here are next to each other, near the end of the selloff.",
  ],
};
