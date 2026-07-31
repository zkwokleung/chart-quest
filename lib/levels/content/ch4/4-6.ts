import type { Level } from "../../schema";

/**
 * AAPL-1d 3355-3411 (2018-04-30 to 2018-07-19), a textbook double top that failed.
 *
 * By `findPatterns`, and it satisfies every threshold with room to spare:
 *
 *   3380  first top   high 48.55  (2018-06-07)
 *   3392  trough      low  45.18  (2018-06-25)
 *   3406  second top  high 48.16  (2018-07-16)
 *
 * The tops are 0.80% apart against a 2% tolerance; the trough sits 6.9% below against
 * a 3% requirement. Nothing about it is marginal.
 *
 * From the close on bar 3410 — the first bar the pattern was knowable — price rose
 * **8.7% in ten bars** and 18.9% in thirty. In ATR terms it went 6.25 average daily
 * ranges the wrong way. This is the hardest failure of any clean double top in the
 * two spine assets.
 *
 * **The level's answer is not "you misread it".** The window stops at the confirmation
 * bar, so the player is looking at exactly what a reader would have had, and there is
 * nothing in it that says "this one will fail". That is the point: 4.5 measured these
 * at 47.6% over 332 examples, so roughly half of them do this, and a chapter that
 * ended without showing one would have taught the base rate as a number rather than as
 * a thing that happens to you.
 *
 * `classify` rather than `spot-the-flaw`. Third time that call has come up — 1.7 and
 * 5.6 made it too — and the reasoning is the same: this is a chart plus a choice, and
 * `spot-the-flaw` is for an artefact that is not a chart. Most likely a backtest report
 * in Chapter 9.
 */
export const level: Level<"classify"> = {
  id: "4-6",
  chapter: 4,
  title: "Nothing wrong with it",
  kind: "classify",
  brief:
    "Apple, summer 2018. Two peaks within one percent of each other, a deep trough between them, four bars of failure to make a new high — a double top by every rule in this chapter. Say what went wrong, then watch what happened.",
  data: [{ series: "AAPL-1d", from: 3355, to: 3411, label: "AAPL · daily" }],
  config: {
    prompt:
      "This pattern was correctly identified and it lost money. What was the mistake?",
    revealBars: 20,
    options: [
      {
        id: "no-mistake",
        label:
          "There wasn't one. About half of these fail, and this was one of them — a correct reading of a pattern that does not have an edge.",
        note: "Correct. 47.6% over 332 examples, and no way to tell in advance which half you are in.",
      },
      {
        id: "should-have-waited",
        label:
          "The neckline was never broken — the entry was taken too early.",
        note: "A real rule, and it would have helped here. It also removes most of your entries, and the ones it removes are not preferentially the losers.",
      },
      {
        id: "wrong-trend",
        label: "It was a bearish pattern inside an uptrend, so it was doomed.",
      },
      {
        id: "not-a-real-one",
        label:
          "The two tops were not level enough — a proper double top needs them nearly identical.",
      },
    ],
  },
  target: { correct: ["no-mistake"] },
  tolerance: {},
  stars: [0.5, 0.9, 1],
  misconceptions: [
    {
      id: "failed-blamed-the-tops",
      test: (attempt) => attempt.selected.includes("not-a-real-one"),
      message:
        "The tops are 0.80% apart, against the 2% this game allows and rather tighter than most textbooks ask for. Tightening the definition until every loser is excluded is how a rule becomes unfalsifiable — and Chapter 9 is about what that does to a backtest.",
    },
    {
      id: "failed-blamed-the-trend",
      test: (attempt) => attempt.selected.includes("wrong-trend"),
      message:
        "It is a tempting rule and 4.2 measured the version of it that applies to pin bars: on Apple the context effect ran the opposite way to the received wisdom, and on Bitcoin it ran the other opposite way. You can always find a context that explains a loss after the fact. That is not the same as one that predicts it.",
    },
    {
      id: "failed-found-a-better-rule",
      test: (attempt) => attempt.selected.includes("should-have-waited"),
      message:
        "Waiting for the neckline is a genuine improvement to the entry and it would have saved you here. What it does not do is turn a coin flip into an edge: it filters out a lot of trades, and the ones it filters are not mostly the losing ones. The instinct to add a condition until the losses disappear is the subject of Chapter 9.",
    },
  ],
  hints: [
    "Check the pattern against the rules from 4.4 and 4.5. Does it actually break one?",
    "4.5 gave you a number for this pattern. What does that number predict about a level like this one?",
  ],
};
