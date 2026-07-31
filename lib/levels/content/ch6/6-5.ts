import type { Level } from "../../schema";

/**
 * BTCUSDT-1d 200-1400, and the seven confirmations behind a trade nobody should take.
 *
 * **The level 6.4 sets up: confluence bought nothing there, and this is why.** Five of these
 * claims are readings of the same series, so they can be correlated against each other.
 * Measured over the window this level names, and stable across SPY and AAPL too:
 *
 *                     rsi   px/ma20   ma20/50   ret10   range/atr
 *   rsi                —      0.907     0.579   0.818       0.128
 *   px vs ma20       0.907      —       0.382   0.926       0.121
 *   ma20 vs ma50     0.579    0.382       —     0.264       0.072
 *   10-bar return    0.818    0.926     0.264     —         0.119
 *   range vs atr     0.128    0.121     0.072   0.119        —
 *
 * `rsi`, `price above its 20-day average` and `the last ten bars were up` sit in one block
 * at 0.82 to 0.93. They are one observation with three names. The other two correlate with
 * nothing much — a moving-average cross is about a slower structure, and a bar's range
 * against its ATR is a statement about volatility rather than direction.
 *
 * The threshold is 0.75 and it sits in a real gap: every member of the block correlates at
 * least 0.688 with another member on all three assets, while the two outsiders peak at
 * 0.609 and 0.31. `lib/ta/correlation.test.ts` asserts that per asset, so if the gap ever
 * closes this level is wrong rather than the test inconvenient.
 *
 * **MACD is not on the list, and that was a decision.** Its histogram runs 0.42 against RSI
 * on Bitcoin and 0.80 against the ten-bar return on SPY — redundant or not depending on
 * which market you ask, which is no basis for a graded answer. It nearly shipped as the
 * "independent" claim: the script that first measured this called `macdSeries` positionally
 * when it takes a params object, which silently returns all nulls and made MACD look
 * uncorrelated with everything.
 *
 * The two non-measurable claims — the daily trend and the round number — are there because
 * a real checklist has items like that, and because the answer has to be "these three are
 * the same thing" rather than "everything is redundant". They are not in `target.flawed`.
 */
export const level: Level<"spot-the-flaw"> = {
  id: "6-5",
  chapter: 6,
  title: "Seven reasons, three facts",
  kind: "spot-the-flaw",
  brief:
    "Somebody has written up a long trade on Bitcoin and listed seven reasons for it. Not one of them is false. Several of them are the same reason wearing a different hat — find those.",
  data: [{ series: "BTCUSDT-1d", from: 200, to: 1400, label: "BTCUSDT · daily" }],
  config: {
    prompt:
      "Which of these confirmations tell you something the others have not already told you? Check the ones that add nothing.",
    reveal: "signal-correlation",
    claims: [
      {
        id: "rsi",
        label: "RSI is above 50 and rising.",
        note: "momentum is positive",
        signal: "rsi",
      },
      {
        id: "price-vs-sma20",
        label: "Price is trading above its 20-day moving average.",
        note: "above the short-term mean",
        signal: "price-vs-sma20",
      },
      {
        id: "return-10",
        label: "The last ten bars have closed higher than the ten before them.",
        note: "the recent trend is up",
        signal: "return-10",
      },
      {
        id: "sma20-vs-sma50",
        label: "The 20-day average has crossed above the 50-day.",
        note: "a slower structure has turned",
        signal: "sma20-vs-sma50",
      },
      {
        id: "range-vs-atr",
        label: "Today's range is wide against the average of the last fourteen.",
        note: "volatility is expanding",
        signal: "range-vs-atr",
      },
      {
        id: "higher-lows",
        label: "The daily chart is making higher lows.",
        note: "structure, read by eye",
      },
      {
        id: "round-number",
        label: "Price has held a round number.",
        note: "a level other people are watching",
      },
    ],
  },
  // The correlated block, recomputed by the content-claims test from the same window.
  target: { flawed: ["rsi", "price-vs-sma20", "return-10"] },
  tolerance: {},
  stars: [0.5, 0.75, 0.95],
  misconceptions: [
    {
      id: "confluence-checked-everything",
      test: (attempt) => attempt.flagged.length >= 6,
      message:
        "Marking nearly all of them is the mirror image of the mistake this level is about. Two of these genuinely are separate facts: a moving-average cross describes a slower structure and correlates 0.38 with price-above-its-average, and a wide range against ATR is a statement about volatility that correlates 0.13 with momentum. Throwing out every confirmation leaves you with no reason to act at all, which is not the lesson.",
    },
    {
      id: "confluence-checked-nothing",
      test: (attempt) => attempt.flagged.length === 0,
      message:
        "Seven separate reasons is what the write-up claims and it is not what it has. RSI above 50, price above its 20-day average, and ten bars closing higher are the same observation measured three ways — they correlate between 0.82 and 0.93 on this window. Counting them separately is how a trader talks themselves into a position and calls it confluence.",
    },
    {
      id: "confluence-kept-the-momentum-block",
      test: (attempt) =>
        !attempt.flagged.includes("rsi") &&
        !attempt.flagged.includes("return-10") &&
        attempt.flagged.length > 0,
      message:
        "The block you have left intact is the redundant one. RSI is a normalised measure of recent gains against recent losses; the ten-bar return is recent gains against recent losses. They are not two witnesses, they are one witness asked twice.",
    },
  ],
  hints: [
    "Ask what each claim is actually measuring. Two of them are measuring how far price has risen lately, in different units.",
    "Three of the seven are about direction over roughly the same recent window.",
  ],
};
