import { barMark } from "../../mark";
import type { Level } from "../../schema";

/**
 * SPY-1d 340-460 (2006-05-10 to 2006-10-27), level 129.43, target bar 413.
 *
 * The second window this level was authored on, and the first one was wrong in a way
 * worth recording. It used the 2009 break of 87.65, which a data scan had reported as
 * "four visits then a break" — but the four visits were spread over a 200-bar
 * lookback the level never showed, and inside the window price was *already above*
 * 87.65 the whole time. The "break" was an artefact of the scan's 0.4% tolerance
 * rather than anything on the chart. A player would have been asked to find a retest
 * of a level that, as far as the visible chart went, had never been broken.
 *
 * This window is the real thing, and all of it is on screen:
 *
 *  - 129.43 is tested three times — bars 342-345, 355-356 and 400-409
 *  - 57 of the 70 bars before the break close clearly below it, so the level is
 *    genuinely resistance rather than a price wandered through
 *  - bar 410 closes decisively above
 *  - bar 413 trades down to 129.19, *through* the level, and closes back at 129.76
 *  - it never closes back below the level again, and is 1.9% above it twenty bars
 *    later and 5.7% forty bars later — a slow hold rather than an explosive one
 *
 * As in 2.5 and 3.5 the honest answer is a small cluster rather than one bar: 411 to
 * 415 all dip into the level and close above. `barSlop: 2` accepts them, and the
 * target is the deepest.
 */
export const level: Level<"mark-bars"> = {
  id: "3-3",
  chapter: 3,
  title: "The retest",
  kind: "mark-bars",
  brief:
    "SPY spent the summer of 2006 stuck under 129.43, testing it three times. Then it broke through. Click the bar that came back down to the level and held.",
  data: [{ series: "SPY-1d", from: 340, to: 460, label: "SPY · daily" }],
  config: {
    prompt:
      "Click the bar that returned to the broken level and closed above it.",
    mode: "bars",
    expected: 1,
  },
  target: { marks: [barMark(413)] },
  tolerance: { barSlop: 2 },
  stars: [0.5, 0.75, 0.95],
  misconceptions: [
    {
      id: "retest-marked-a-test-before-the-break",
      test: (attempt) =>
        attempt.marks.some((mark) => {
          const bar = Number(mark.replace("bar:", ""));
          return bar < 410;
        }),
      message:
        "That is one of the times price failed at the level, before it broke. Those tests are what made it a level worth watching — but a retest happens after the break, when the same price has to work as support instead of resistance.",
    },
    {
      id: "retest-marked-the-continuation",
      test: (attempt) =>
        attempt.marks.some((mark) => {
          const bar = Number(mark.replace("bar:", ""));
          return bar >= 418;
        }),
      message:
        "By then the level had already done its job and price had left. The bar that matters is the one that went back into the level while the outcome was still unknown — that is the only moment the information is worth anything.",
    },
  ],
  hints: [
    "Find the bar that closed decisively above 129.43, then look at what happened over the next few days.",
    "One bar traded back down through 129.43 and still closed above it.",
  ],
};
