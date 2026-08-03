import type { Level } from "../../schema";

/**
 * Five flips, thirty-two outcomes, and the score the player earned in Chapter 1.
 *
 * ## The specified kind cannot hold, for three reasons
 *
 * `CURRICULUM.md` lists 9.2 as `predict-next`, recalling the 1.B coin-flip score. Three things
 * make that impossible rather than merely awkward:
 *
 * A grader is pure — it takes `(attempt, level, data)` and cannot read the store — so the
 * player's stored score cannot reach the scoring at all.
 *
 * `predict-next` scores *participation* rather than accuracy, on purpose: 1.B exists to prove
 * the player cannot predict, and a kind that rewarded correct guesses would undo it.
 *
 * And `predictions["1-B"]` is simply absent for a real fraction of players — a fresh save, a
 * `resetProgress`, or private mode where storage degraded to memory. A level whose answer
 * depended on it would be unanswerable for them.
 *
 * So the graded question is arithmetic, author-known and independent of the store, and the
 * player's own score is **marked on the distribution as evidence** beside it. The artefact
 * degrades to "no Chapter 1 boss score recorded", and the question reads identically either way.
 * The chapter's claims test asserts this for every Chapter 9 level.
 *
 * ## The arithmetic
 *
 *   0 right  1/32   3.1%      3 right  10/32  31.2%
 *   1 right  5/32  15.6%      4 right   5/32  15.6%
 *   2 right 10/32  31.2%      5 right   1/32   3.1%
 *
 * Two or three right happens 62.5% of the time, which is why 1.B lands near half for almost
 * everybody. And a player who went five for five reads **3.1%** — one flipper in thirty-two —
 * which is the sentence 1.B spent a chapter earning.
 *
 * The graded answer is that five of five is unremarkable in a large enough room, because that is
 * the inference the whole chapter needs and the one a good score actively resists.
 */
export const level: Level<"classify"> = {
  id: "9-2",
  chapter: 9,
  title: "How much of that was luck",
  kind: "classify",
  brief:
    "The Chapter 1 boss asked you to call five bars. Here is what a coin does at the same task, all thirty-two ways it can come out — with your own score marked, if the game still has it. Somebody gets five out of five. The question is what that tells you about them.",
  data: [],
  config: {
    prompt:
      "Out of a thousand people flipping five coins, about thirty get all five right. What does a five-out-of-five score prove about the person who got it?",
    artefact: "coin-flip-distribution",
    options: [
      {
        id: "nothing",
        label:
          "Almost nothing. In a room of a thousand, thirty-one get five right by luck alone — and every one of them will have an explanation.",
        note: "Correct. 1/32 is 3.1%, so five of five is what a coin does thirty-one times in a thousand. Five trades cannot separate skill from luck no matter how they come out, which is why Chapter 4 kept showing you sample sizes.",
      },
      {
        id: "some-skill",
        label:
          "Some skill. Getting all five right is unlikely enough that chance alone probably does not explain it.",
        note: "Unlikely for one named person in advance; ordinary across a crowd. The distinction is the entire subject of this chapter, and it is what a p-value is for.",
      },
      {
        id: "needs-more-rounds",
        label: "Nothing yet — but ten more rounds would settle it.",
        note: "Closer, and still optimistic. Fifteen rounds at a 50% base rate leaves an interval far too wide to certify anybody; Chapter 4's smallest pattern had sixty-six examples and its interval was still 20 points wide.",
      },
      {
        id: "beat-the-market",
        label: "That they can read a chart — five for five is not a coin flip.",
      },
    ],
  },
  target: { correct: ["nothing"] },
  tolerance: {},
  stars: [0.5, 0.9, 1],
  misconceptions: [
    {
      id: "luck-confused-one-with-many",
      test: (attempt) =>
        attempt.selected.includes("some-skill") ||
        attempt.selected.includes("beat-the-market"),
      message:
        "Both of those confuse a chance about one person with a chance about a crowd. The odds of *you specifically* going five for five are 1 in 32, which is genuinely unlikely. The odds of *somebody* in a thousand doing it are effectively one — thirty-one of them will. Every trading course with a testimonial is that arithmetic, sold back to you.",
    },
    {
      id: "luck-thought-more-rounds-would-do-it",
      test: (attempt) => attempt.selected.includes("needs-more-rounds"),
      message:
        "The instinct is right and the number is not. Ten more rounds gives fifteen calls, and fifteen at a 50% base rate still leaves an interval that includes both 'no skill' and 'considerable skill'. Chapter 4's rarest pattern had sixty-six examples and its confidence interval was still twenty points wide. This is why 9.1 asked for an expectancy rather than a win rate.",
    },
    {
      id: "luck-your-own-score",
      test: () => false,
      message:
        "Whatever you scored in 1.B, the honest reading is the same: five bars is not enough to know anything about you. That was the point of making the first boss unwinnable-by-skill, and it is the baseline every chapter since has been measured against.",
    },
  ],
  hints: [
    "Count how many of the thirty-two ways five flips can land give all five right.",
    "Ask the question about a thousand people rather than about one.",
  ],
};
