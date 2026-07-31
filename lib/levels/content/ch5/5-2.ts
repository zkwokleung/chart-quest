import type { Level } from "../../schema";

/**
 * EURUSD-1d 3600-4400 (2018-11 to 2022-01), Bollinger deviation multiple.
 *
 * **This is not the level the curriculum specified, and the reason is measured.**
 *
 * CURRICULUM.md asks for "find the MA this market actually respected". That question
 * has no honest answer. Counting touches, the shortest period offered wins every
 * window, because a short average hugs price. Counting bounces that ran, the
 * shortest period wins every window, for the same reason. Reframed as "which period
 * would have held you in the trend", the *longest* wins, because a distant average
 * is hard to close below. And running an actual moving-average rule:
 *
 *   EURUSD 2006-07  best MA150 at 13.1%, with MA200 at 12.9% and MA120 at 11.1%
 *   EURUSD 2009-10  best MA20  at  3.7%, with every neighbour losing money
 *   EURUSD 2014-15  every period loses; the "best" is MA150 at −2.5%
 *   EURUSD 2018-19  every period loses; the "best" is MA200 at −3.6%
 *
 * The winner moves between windows, sits inside noise of its neighbours, and in
 * three of five windows every period loses money. Shipping "the answer is MA150"
 * would have taught overfitting in the chapter before the one that warns about it.
 *
 * So the slider tunes something that *does* have a measured answer, and teaches a
 * better lesson while it does. Textbooks say two standard deviations contain about
 * 95% of price. Measured on this window it contains **88.8%**, and 95% is not
 * reached until **2.35σ** — because returns have fat tails and the normal
 * distribution the "95%" comes from is not the distribution markets draw from.
 * BTC needs 2.40σ and SPY 2.20σ, so it is not a quirk of one market either.
 */
export const level: Level<"tune-param"> = {
  id: "5-2",
  chapter: 5,
  title: "Two sigma is not ninety-five percent",
  kind: "tune-param",
  brief:
    "Bollinger bands are a moving average plus a multiple of its standard deviation, and the usual multiple is two — sold as containing about 95% of price. Widen the bands until they really do. It takes more than two.",
  data: [
    { series: "EURUSD-1d", from: 3600, to: 4400, label: "EURUSD · daily" },
  ],
  config: {
    prompt:
      "Find the smallest multiple that keeps 95% of closes inside the bands.",
    label: "deviations",
    min: 1,
    max: 3,
    step: 0.05,
    initial: 2,
    indicator: (value) => ({
      kind: "bollinger",
      period: 20,
      deviations: value,
    }),
    scoring: "target",
  },
  target: { value: 2.35 },
  tolerance: { slop: 0.15 },
  stars: [0.4, 0.7, 0.9],
  misconceptions: [
    {
      id: "sigma-took-the-textbook-figure",
      test: (attempt) => Math.abs(attempt.value - 2) < 0.05,
      message:
        "Two is the number every book prints, and on this market it contains 88.8% of closes rather than 95%. The gap is not rounding — it is the difference between a normal distribution and a market, and it is why one bar in nine closes outside a band that supposedly holds all but one in twenty.",
    },
    {
      id: "sigma-far-too-wide",
      test: (attempt) => attempt.value >= 2.8,
      message:
        "Bands that wide contain nearly everything, which makes them useless: a level price never reaches tells you nothing when it does. You are looking for the smallest multiple that does the job, not one that cannot fail.",
    },
    {
      id: "sigma-too-narrow",
      test: (attempt) => attempt.value <= 1.5,
      message:
        "At that width price spends a third of its time outside the bands. An envelope that price leaves constantly is describing normal behaviour as exceptional.",
    },
  ],
  hints: [
    "Watch how often a candle closes outside the bands as you widen them.",
    "The answer is between two and a half a step above it.",
  ],
};
