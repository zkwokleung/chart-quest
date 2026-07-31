import type { Level } from "../../schema";

/**
 * AAPL-1d 790-826 and 3254-3290, each ending on a bullish pin bar.
 *
 * Both charts end on the same shape. What happened next:
 *
 *   bar 825 (2008-04-15), after an uptrend   +17.9% over ten bars   +5.24 ATR
 *   bar 3289 (2018-01-26), inside a range     −8.8% over ten bars   −6.15 ATR
 *
 * **The curriculum expects this level to show that trend beats chop, and the data
 * does not say that.** Every bullish pin bar in both spine assets, sorted by the
 * structure over the fifty bars before it:
 *
 *            uptrend            range              downtrend
 *   AAPL     51.2% / +0.10 ATR  57.9% / +0.64 ATR  64.7% / +0.59 ATR   (n=84/254/51)
 *   BTC      53.9% / +1.28 ATR  53.7% / +0.12 ATR  53.8% / −0.08 ATR   (n=76/147/39)
 *
 * On Apple a bullish pin bar did best *against* the prevailing move and worst with
 * it. On Bitcoin it did best with the move and worst against it. The two assets
 * disagree about the sign of the effect, so "pin bars work in trends" is not a fact
 * about pin bars — it is a fact about whichever market someone happened to check.
 *
 * That makes the honest answer to this level "the shape is not the information",
 * which is a stronger version of the lesson the curriculum asked for and arrives with
 * its own evidence. The two charts are the illustration; the table is the argument.
 */
export const level: Level<"classify"> = {
  id: "4-2",
  chapter: 4,
  title: "The same candle, twice",
  kind: "classify",
  brief:
    "Two charts, both Apple, both ending on a bullish pin bar that closed near its high after a long lower wick. One of them ran hard. The other did the opposite. Commit an answer and you will see which was which.",
  data: [
    { series: "AAPL-1d", from: 790, to: 826, label: "A · AAPL, spring 2008" },
    { series: "AAPL-1d", from: 3254, to: 3290, label: "B · AAPL, winter 2018" },
  ],
  config: {
    prompt:
      "Both charts end on the same pattern. What does the pattern, by itself, tell you about what happens next?",
    revealBars: 10,
    options: [
      {
        id: "nothing-alone",
        label:
          "Nothing you can act on. The same shape preceded a hard rally and a hard fall, so the shape is not carrying the information.",
        note: "Correct — and measured. On Apple these did better after downtrends; on Bitcoin, better after uptrends. The rule does not transfer.",
      },
      {
        id: "trend-context",
        label:
          "It works when it agrees with the trend and fails when it does not.",
        note: "Reasonable, widely taught, and contradicted by the data: on Apple bullish pin bars performed *worst* in uptrends (51.2%) and best after downtrends (64.7%).",
      },
      {
        id: "bullish-signal",
        label: "It is a bullish signal — a rejection of lower prices.",
      },
      {
        id: "volume-tells",
        label:
          "Nothing yet — you would need to see the volume on the pin bar to know.",
      },
    ],
  },
  target: { correct: ["nothing-alone"] },
  tolerance: {},
  stars: [0.5, 0.9, 1],
  misconceptions: [
    {
      id: "pattern-context-rule-imported",
      test: (attempt) => attempt.selected.includes("trend-context"),
      message:
        "This is the standard answer and it does not survive being measured. Bullish pin bars on Apple won 51.2% of the time in uptrends and 64.7% after downtrends — the opposite of the rule. On Bitcoin the ordering flips the other way. Context does change the number; nobody can tell you in advance which way, so you have to measure it on the market you are trading.",
    },
    {
      id: "pattern-read-the-shape-as-signal",
      test: (attempt) => attempt.selected.includes("bullish-signal"),
      message:
        "The long lower wick does mean price was rejected — and it meant that on both charts, one of which then fell 8.8%. A description of what already happened is not a prediction, which is the same trap 5.3 sets with RSI two chapters from now.",
    },
    {
      id: "pattern-waiting-for-one-more-input",
      test: (attempt) => attempt.selected.includes("volume-tells"),
      message:
        "Volume would give you another description of the same bar, not a different kind of fact. The problem here is not that one input is missing; it is that the shape did both things, so no reading of the shape separates the two cases.",
    },
  ],
  hints: [
    "Look at the two charts before the last bar. Is one of them in a trend?",
    "Ask what you would have to believe for the same shape to imply two opposite outcomes.",
  ],
};
