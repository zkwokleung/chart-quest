import type { Level } from "../../schema";

/**
 * SPY-1d 686-1056 — thirteen losing trades in a row, 2007-10-23 to 2008-11-26.
 *
 * **The spec says six. The data says thirteen.**
 *
 * Trading the chapter's rule sequentially on SPY, entering only when flat, produces a run of
 * thirteen consecutive losses through the financial crisis. LAKE and EURUSD hold thirteen too. Six
 * would have been an invention, and a comforting one — the whole point of the level is that the
 * streak is longer than anyone plans for.
 *
 * Eleven of the thirteen lost exactly −1.00R. **Two lost more** — −1.0605R on 2008-10-23 and
 * −1.0290R on 2008-11-26 — because both gapped through the stop overnight, and a stop does not
 * protect across a gap. 1.6 measured that; this is where it costs money. The run totals −13.09R
 * rather than −13.00R.
 *
 * What the sizing does to it, compounded on the real thirteen rather than on thirteen tidy −1s:
 *
 *   at 1% risk    87.7% of the account left, +14.1% needed to recover
 *   at 2%         76.8%, +30.3% needed
 *   at 5%         51.1%, +95.7% needed
 *   at 10%        25.2%, +297% needed
 *
 * A `classify` rather than a new interaction. The same streak at two position sizes is exact
 * arithmetic, and building a harness to animate a sum would be machinery rather than teaching —
 * 7.B is where the account moves under the player's own decisions.
 */
export const level: Level<"classify"> = {
  id: "7-6",
  chapter: 7,
  title: "Thirteen in a row",
  kind: "classify",
  brief:
    "This is SPY from late 2007 through 2008, and the rule you have been trading lost thirteen times in a row across it. Not six. Thirteen, two of them gapping through the stop for more than a full R. The rule was not broken. This is what a rule doing its job looks like sometimes.",
  data: [{ series: "SPY-1d", from: 686, to: 1056, label: "SPY · daily" }],
  config: {
    prompt:
      "Thirteen straight losses. What separates a trader who survives it from one who does not?",
    options: [
      {
        id: "position-size",
        label:
          "The fraction risked per trade — at 1% the account keeps 87.7% of itself, at 5% it keeps half.",
        note: "Correct. Nothing else in the sequence is different: same entries, same stops, same thirteen losses.",
      },
      {
        id: "better-entries",
        label:
          "Better entries — a sharper filter would have avoided most of these trades.",
        note: "Perhaps, and you cannot know which ones in advance. Sizing works whether or not the filter does.",
      },
      {
        id: "stop-trading",
        label:
          "Stopping after three or four losses and waiting for conditions to improve.",
      },
      {
        id: "increase-size",
        label:
          "Raising the size after a few losses, so that one win recovers the run.",
      },
    ],
  },
  target: { correct: ["position-size"] },
  tolerance: {},
  stars: [0.5, 0.9, 1],
  misconceptions: [
    {
      id: "streak-martingale",
      test: (attempt) => attempt.selected.includes("increase-size"),
      message:
        "This is the answer that ends accounts. Doubling into a losing run needs the run to end before the money does, and this one ran thirteen deep — nobody sizing up at loss four had anything left by loss nine. The arithmetic is unforgiving: at 10% flat the account is down to 25.2% and needs to gain 297% to recover. Raising the risk makes both halves of that worse.",
    },
    {
      id: "streak-would-have-filtered-them",
      test: (attempt) => attempt.selected.includes("better-entries"),
      message:
        "Very likely true and no use to you. Every one of these thirteen looked like the winners did at the moment of entry — that is why they were taken. A filter you can only apply afterwards is a story about the past; position size is a decision you make before, and it works whether or not the filter does.",
    },
    {
      id: "streak-sat-it-out",
      test: (attempt) => attempt.selected.includes("stop-trading"),
      message:
        "Defensible discipline, and it needs a rule for when to come back that this chapter has not given you — stopping after four losses in a 43%-hit-rate strategy means stopping often, and the recoveries are in the trades you skipped. The sizing answer needs no such judgement: at 1% the streak costs 12.3% of the account and you are still trading.",
    },
  ],
  hints: [
    "Work out what thirteen losses at 1% leaves, then the same thirteen at 5%.",
    "Ask which of these four is a decision you can make before knowing what happens.",
  ],
};
