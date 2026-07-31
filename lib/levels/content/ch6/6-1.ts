import type { Level } from "../../schema";

/**
 * BTCUSDT-4h 4521-4569 with BTCUSDT-1d 1905-1995 behind it — the same eight days seen
 * twice.
 *
 * **Slice 0 is the lower timeframe, throughout Chapter 6.** `ReplayTrade` places its trade
 * on slice 0 and `linkablePair` makes the finer timeframe the driver, so listing the 4h
 * first keeps one convention across the chapter and keeps the trade levels correct. The
 * labels say which pane is which.
 *
 * Measured over these windows:
 *
 *   daily 1905-1995   uptrend    +12%   10 swing highs, 9 swing lows
 *   4h    4521-4569   range       +1%    4 swing highs, 4 swing lows
 *
 * Both readings are corroborated — the label agrees with the window's own net move — and
 * both have enough swings to be worth reading. That combination is rarer than it sounds:
 * of every 4h window in the series, requiring three highs and three lows on *both* panes
 * plus corroboration on both leaves a few dozen, and this is one of them.
 *
 * **Two things the search turned up that changed this level.** First, `readStructure` on a
 * short window reports its tail rather than the window: daily 1752-1782 fell 35.3% and
 * reads as an *uptrend*, because its only four swings sit in the closing bounce. So the
 * higher-timeframe pane here is 90 bars, not 30, and the content-claims test demands the
 * label agree with the net move.
 *
 * Second, the pairing the curriculum implies — a trending higher timeframe with a trending
 * lower one — barely exists. What is abundant is this: the higher timeframe trends and the
 * lower one *pauses*. Which is exactly what "HTF bias, LTF entry" describes, so the level
 * is the specified one; it just took measuring to see that the pause is the subject rather
 * than a special case.
 */
export const level: Level<"classify"> = {
  id: "6-1",
  chapter: 6,
  title: "Two clocks, one market",
  kind: "classify",
  brief:
    "The same eight days of Bitcoin, twice. The lower pane is four-hour bars and it has gone nowhere. The upper pane is daily, running four months back, and it is up twelve percent. Neither is wrong.",
  data: [
    { series: "BTCUSDT-4h", from: 4521, to: 4569, label: "4-hour · the last eight days" },
    { series: "BTCUSDT-1d", from: 1905, to: 1995, label: "Daily · the last four months" },
  ],
  config: {
    prompt:
      "The four-hour chart is flat and the daily is trending up. What is the flat stretch?",
    revealBars: 12,
    options: [
      {
        id: "a-pause",
        label:
          "A pause inside the daily uptrend — the same move, seen close enough that it looks like nothing is happening.",
        note: "Correct. A range on one timeframe is a single bar on a slower one; that is arithmetic, not interpretation.",
      },
      {
        id: "conflict",
        label:
          "A conflict. One of the two timeframes must be giving the wrong reading.",
        note: "Neither reading is wrong: eight flat days inside four rising months are both true at once.",
      },
      {
        id: "reversal",
        label: "The start of a reversal — the uptrend has stopped working.",
      },
      {
        id: "use-the-lower",
        label:
          "Irrelevant. The lower timeframe is the more recent information, so it is the one to act on.",
      },
    ],
  },
  target: { correct: ["a-pause"] },
  tolerance: {},
  stars: [0.5, 0.9, 1],
  misconceptions: [
    {
      id: "mtf-read-it-as-conflict",
      test: (attempt) => attempt.selected.includes("conflict"),
      message:
        "There is nothing to reconcile. Forty-eight four-hour bars are eight daily bars, and eight flat days inside a four-month advance is an ordinary thing for a market to do. Two timeframes only conflict when you expect them to be answering the same question, and they are not: one is asking where price has come from, the other where it is right now.",
    },
    {
      id: "mtf-called-a-reversal",
      test: (attempt) => attempt.selected.includes("reversal"),
      message:
        "It might become one. What you have so far is an absence of movement, and Chapter 2 was explicit that a range is not a reversal until structure breaks — nothing here has broken. Reading a pause as a turn is how a trader ends up short in an uptrend.",
    },
    {
      id: "mtf-preferred-the-faster-chart",
      test: (attempt) => attempt.selected.includes("use-the-lower"),
      message:
        "The lower timeframe is not more recent — both panes end on the same bar. It is more *detailed*, which is a different thing, and detail without context is how the same eight bars can be read as a top, a pause or a base depending on nothing but where you started looking.",
    },
  ],
  hints: [
    "Count how many four-hour bars fit inside one daily bar, then ask how many daily bars this flat stretch occupies.",
    "Look at where the flat stretch sits on the daily chart. Is it at the top of the move, or in the middle of it?",
  ],
};
