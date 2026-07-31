import type { Level } from "../../schema";

/**
 * BTCUSDT-4h 2310-2400 with BTCUSDT-1d 1543-1633 behind it — January 2022.
 *
 * Measured:
 *
 *   daily 1543-1633   downtrend   −34.3%   7 swing highs, 9 swing lows
 *   4h    2310-2400   uptrend      +8.1%   8 swing highs, 10 swing lows
 *
 * A genuine disagreement, and both readings are corroborated by their own window's net
 * move. **Windows like this are rare enough to be worth stating.** Requiring three swing
 * highs and three swing lows on each pane, plus the label agreeing with the net move,
 * leaves fifteen opposed windows in the whole 4h series — and only at a short lower-
 * timeframe window against a long higher-timeframe one. Widen the lower window past about
 * ninety bars and the count goes to zero: a fortnight can oppose a quarter, a quarter
 * cannot.
 *
 * The corroboration requirement is not decoration. `readStructure` on a short window
 * reports its tail: daily 1752-1782 fell 35.3% and reads as an *uptrend*, because its only
 * four swings sit in the closing bounce. Half the apparent disagreements in this series are
 * that artefact rather than a market doing two things at once.
 *
 * **The daily window overlaps the one 5.5 uses.** Deliberate, and disclosed: it is ninety
 * bars of background context behind a fortnight of 4h bars, not a reused answer — 5.5 asks
 * about ATR on it and this level asks about structure. Without the overlap there is no
 * corroborated disagreement anywhere in the series, which would mean either a level built
 * on a reading that contradicts its own prices or no level at all.
 */
export const level: Level<"classify"> = {
  id: "6-3",
  chapter: 6,
  title: "A fortnight against a quarter",
  kind: "classify",
  brief:
    "Bitcoin, early 2022. The four-hour chart has made higher highs and higher lows for two weeks and is up eight percent. The daily chart, running back three months, is down thirty-four. Both of those are readings of the same market.",
  data: [
    { series: "BTCUSDT-4h", from: 2310, to: 2400, label: "4-hour · the last fortnight" },
    { series: "BTCUSDT-1d", from: 1543, to: 1633, label: "Daily · the last quarter" },
  ],
  config: {
    prompt: "The two timeframes disagree. What is the four-hour uptrend?",
    revealBars: 20,
    options: [
      {
        id: "counter-trend-rally",
        label:
          "A rally inside a downtrend. It is real, it is tradeable, and it is the thing a downtrend does most often — which is why it is not evidence the downtrend has ended.",
        note: "Correct. Naming it changes how you size it and where you take profit; pretending it is a new uptrend does not.",
      },
      {
        id: "trend-change",
        label:
          "The downtrend is over. Higher highs and higher lows is the definition of an uptrend, and that is what the lower timeframe now shows.",
        note: "It is the definition of an uptrend *on that timeframe*. The quarter-long sequence of lower highs is still intact, and price went on to make new lows.",
      },
      {
        id: "stand-aside",
        label:
          "Nothing tradeable. When timeframes disagree the honest answer is to wait for them to agree.",
      },
      {
        id: "faster-wins",
        label:
          "The four-hour reading supersedes the daily one, because it is built from more recent bars.",
      },
    ],
  },
  target: { correct: ["counter-trend-rally"] },
  tolerance: {},
  stars: [0.5, 0.9, 1],
  misconceptions: [
    {
      id: "mtf-called-the-turn",
      test: (attempt) => attempt.selected.includes("trend-change"),
      message:
        "This is the expensive answer and it is the common one. Two weeks of higher lows inside a three-month sequence of lower highs is a bear-market rally, and this one gave back everything and more. Chapter 2's structural test is what settles it: the daily chart had not broken a single lower high, so nothing had changed on the timeframe that was doing the trending.",
    },
    {
      id: "mtf-waited-for-agreement",
      test: (attempt) => attempt.selected.includes("stand-aside"),
      message:
        "Defensible discipline, and also a rule that removes most of your opportunities: the timeframes agree least often exactly when a move is starting. The useful move is not to stand aside but to know which one you are trading — a counter-trend rally with a tight stop and a near target is a different trade from a trend continuation, not a forbidden one.",
    },
    {
      id: "mtf-faster-supersedes",
      test: (attempt) => attempt.selected.includes("faster-wins"),
      message:
        "Both panes end on the same bar, so neither is more recent. What the four-hour chart has is resolution, and resolution without span is how a fortnight gets mistaken for a trend. The daily pane is not older information; it is more of it.",
    },
  ],
  hints: [
    "Check the daily chart for a broken lower high. Chapter 2 said that is what changes a downtrend.",
    "Ask what the four-hour move would have to do to matter on the daily chart, and how far away that is.",
  ],
};
