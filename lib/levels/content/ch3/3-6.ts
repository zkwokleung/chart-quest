import type { Level } from "../../schema";

/**
 * SPY-1d 4380-4510, the break of 402.31 on 2022-11-30, with a 20-bar horizon.
 *
 * The chapter's trap, and it is a round number on purpose — 3.5 has just spent a
 * level showing that everyone's stop sits under the obvious figure. Measured: 402.31
 * was visited four times before the break, the break closed **1.33% above** it, and
 * price was back below within **three bars** and **4.7% below** twenty bars on.
 *
 * The window starts at 4380 rather than 4450 because of a content-claims failure
 * worth keeping: at 4450 the chart showed only **two** of those four tests, so the
 * brief asserted a level the player could not see being tested. A trap is only fair
 * if the setup it imitates is visible.
 *
 * The kind scores participation rather than accuracy, which is exactly right here.
 * The player is meant to look at a textbook-clean break of a well-tested level, call
 * it, and be wrong — and to have that cost them nothing but the lesson. Grading
 * accuracy would either punish them for the correct read or teach that this pattern
 * is reliably a fake, which is its own falsehood.
 */
export const level: Level<"predict-next"> = {
  id: "3-6",
  chapter: 3,
  title: "The clean break that wasn't",
  kind: "predict-next",
  brief:
    "A level tested four times, then a decisive close 1.3% above it. Everything Chapter 3 has taught says this is the one. Call the next twenty bars.",
  data: [{ series: "SPY-1d", from: 4380, to: 4510, label: "SPY · daily" }],
  config: {
    prompt: "Where is price twenty bars from here?",
    horizon: 20,
  },
  target: {},
  tolerance: {},
  stars: [0.9, 0.95, 1],
  misconceptions: [
    {
      id: "clean-break-unanswered",
      test: (attempt) => attempt.calls.some((call) => call === null),
      message:
        "Make the call. This level scores whether you committed, not whether you were right — and refusing to commit is how you avoid ever finding out what your reads are worth.",
    },
    {
      id: "clean-break-was-clean",
      test: (attempt) => attempt.calls.length > 0,
      message:
        "It failed. Four touches, a 1.3% close above the level, and price was back underneath within three days and 4.7% lower inside a month. Nothing about that break was badly formed — this is what a clean setup failing looks like, and it is why the next level makes you place a stop before you find out.",
    },
  ],
  hints: [
    "Ask what makes this different from the three breaks that held in 3.4. Then ask whether you can actually tell.",
  ],
};
