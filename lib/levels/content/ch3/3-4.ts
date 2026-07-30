import type { Level } from "../../schema";

/**
 * Six SPY breaks, three real and three failed, in **magnitude-matched pairs**.
 *
 * The chapter's most carefully built level, because the obvious shortcut has to be
 * closed off. Across the whole series the failed breaks closed *further* above their
 * level than the real ones — mean 1.5% against 1.2% — so "a bigger, more decisive
 * break is more likely to be real" is not merely unreliable here, it is backwards.
 * A level that let a player win by that heuristic would teach the inverse of its own
 * lesson, and a level that let them win by the *reverse* heuristic would be no
 * better.
 *
 * So the six are chosen as three pairs whose closes above the level are within a
 * tenth of a percentage point of each other, one real and one failed in each:
 *
 *   A 1639 (2011-07-07) failed, +1.01%   F 4001 (2020-11-23) real, +0.97%
 *   C  844 (2008-05-12) failed, +0.95%   B 2204 (2013-10-04) real, +0.95%
 *   E 1961 (2012-10-15) failed, +0.69%   D 3732 (2019-10-30) real, +0.63%
 *
 * Magnitude carries no signal by construction, which a content-claims test asserts
 * pair by pair. Each window is also 90 bars rather than 60, because at 60 the charts
 * did not show their own level being tested three times — the level would have been
 * asking about structure it never displayed.
 *
 * What separates them is what happened at the level beforehand and how price behaved
 * on the way back — which is the thing worth learning.
 *
 * `revealBars: 20` shows each chart's next twenty bars after committing, through the
 * feed, so the reveal cannot be read before the answer is locked in.
 */
export const level: Level<"classify"> = {
  id: "3-4",
  chapter: 3,
  title: "Breakout or fakeout",
  kind: "classify",
  brief:
    "Six breaks of a tested level. Three held and three failed. The size of the breakout candle will not tell you which — in this market the failures were the more convincing ones.",
  data: [
    { series: "SPY-1d", from: 1550, to: 1640, label: "A" },
    { series: "SPY-1d", from: 2115, to: 2205, label: "B" },
    { series: "SPY-1d", from: 755, to: 845, label: "C" },
    { series: "SPY-1d", from: 3643, to: 3733, label: "D" },
    { series: "SPY-1d", from: 1872, to: 1962, label: "E" },
    { series: "SPY-1d", from: 3912, to: 4002, label: "F" },
  ],
  config: {
    prompt: "Which of these breakouts held? Choose all three.",
    multiple: true,
    revealBars: 20,
    options: [
      {
        id: "a",
        label: "A held",
        note: "Failed — and it closed further above its level than any of the three that held.",
      },
      {
        id: "b",
        label: "B held",
        note: "Held. 5.3% above the level twenty bars on.",
      },
      {
        id: "c",
        label: "C held",
        note: "Failed — 2.3% below the level twenty bars on.",
      },
      {
        id: "d",
        label: "D held",
        note: "Held. 4.4% above the level twenty bars on.",
      },
      {
        id: "e",
        label: "E held",
        note: "Failed — 5% below the level twenty bars on.",
      },
      {
        id: "f",
        label: "F held",
        note: "Held. 3.7% above the level twenty bars on.",
      },
    ],
  },
  target: { correct: ["b", "d", "f"] },
  tolerance: {},
  stars: [0.5, 0.75, 0.95],
  misconceptions: [
    {
      id: "fakeout-picked-the-biggest",
      test: (attempt) =>
        attempt.selected.includes("a") || attempt.selected.includes("c"),
      message:
        "You picked one of the decisive ones. That is the trap: A closed further above its level than any of the three that actually held, and it was 10% lower a month later. A big candle tells you people were eager, not that they were right.",
    },
    {
      id: "fakeout-wrong-count",
      test: (attempt) => attempt.selected.length !== 3,
      message:
        "Three of the six held. Choosing more or fewer means the question was not the one you answered — and on a real chart the count is the part you never get told.",
    },
  ],
  hints: [
    "Stop looking at the breakout candle and look at what price did on the way back to the level.",
    "Compare how long each break took to be tested, and whether the level held when it was.",
  ],
};
