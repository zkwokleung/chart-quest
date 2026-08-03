import type { Level } from "../../schema";

/**
 * March 2020, four markets, one date range — and the hedge that was not one.
 *
 * The specified level was "your 5 diversified longs are one bet. See the matrix, then the joint
 * drawdown." Measured over 1,429 date-aligned days, **that is not true of this spine.** Only
 * one pair clears 0.6, and it is the obvious one — a single stock against its own index at
 * 0.80. Everything else runs 0.00 to 0.28. The book really is diversified.
 *
 * So the level asks the better question, which the same data answers emphatically. Correlations
 * conditioned on the index's worst decile, against their all-days figures:
 *
 *   BTC / gold    0.12 -> 0.37   (+0.25)
 *   BTC / index   0.28 -> 0.46   (+0.18)
 *   gold / index  0.08 -> 0.24   (+0.16)
 *   BTC / small   0.08 -> 0.18   (+0.10)
 *   AAPL / index  0.80 -> 0.70   (−0.10)
 *   small / index 0.04 -> −0.03  (−0.07)
 *
 * **Bitcoin is the asset that converges on everything.** Uncorrelated with the index on
 * ordinary days — 0.01 in the middle tenth — and nearly half an index position on the worst
 * ones, while simultaneously tightening against gold. The pair that is *always* one bet
 * (Apple and the index) does not get worse, because it cannot; the genuine diversifiers, the
 * euro and the small-cap, stay genuine. So the lesson is not the slogan "correlations go to
 * one" — it is that **the asset sold as a hedge is the one that stops being one**, and an
 * average is the wrong statistic for a question about disasters.
 *
 * ## The window
 *
 * The COVID crash, 2020-01 to 2020-04, the same calendar range on all four panes so the falls
 * are directly comparable. Peak to trough: Bitcoin −53.6%, the small-cap −43.2%, the index
 * −34.1%, gold −15.9%. Bitcoin, the supposed uncorrelated asset, fell hardest of the four.
 *
 * On a percent axis, because that is the only way four markets at four price scales can be
 * compared by eye — and because Chapter 8 is where the axis control stops being a control and
 * starts being how you read a chart.
 *
 * **These bars are not all new, and that is deliberate.** Earlier chapters showed some of this
 * window. Recognising March 2020 is the point: the player knows what happened, has measured
 * that these markets are barely correlated, and gets to watch the two facts fail to fit
 * together. A crash nobody recognised would make the same statistical point and land softer.
 *
 * **And no joint-drawdown visualisation.** Four real price panels say "these fell together"
 * better than a synthetic equity curve of a book nobody holds, and the drawdown *numbers* are
 * rows under the matrix where they can be read against each other. Apple appears there and
 * nowhere on screen, which is what keeps it available for the boss.
 */
export const level: Level<"classify"> = {
  id: "8-4",
  chapter: 8,
  title: "One bet, four names",
  kind: "classify",
  brief:
    "You have measured these markets against each other and they are barely correlated — the highest pair in the whole spine outside a stock and its own index is 0.28. So a basket of them is diversified, and the numbers say so. Here is the same three months on four of them. Look at what diversified bought you.",
  data: [
    { series: "BTCUSDT-1d", from: 886, to: 987, label: "Bitcoin · Jan–Apr 2020" },
    { series: "SPY-1d", from: 3787, to: 3857, label: "S&P 500 · Jan–Apr 2020" },
    { series: "LAKE-1d", from: 3787, to: 3857, label: "Small-cap · Jan–Apr 2020" },
    { series: "GC-1d", from: 3780, to: 3850, label: "Gold · Jan–Apr 2020" },
  ],
  // Percent from the first bar shown, so four price scales become one comparison.
  yAxis: "pct",
  config: {
    prompt:
      "Average correlations said this basket was diversified. What actually happened on the days that mattered?",
    reveal: "asset-correlation",
    options: [
      {
        id: "hedge-failed",
        label:
          "The one asset sold as a hedge fell hardest, and tightened against everything else exactly when it was needed.",
        note: "Correct. Bitcoin is 0.01 against the index on ordinary days and 0.46 on its worst decile, while also going from 0.12 to 0.37 against gold. It fell 53.6% here — more than the index, more than the small-cap.",
      },
      {
        id: "all-to-one",
        label: "Everything went to one — in a crisis all correlations converge.",
        note: "Not everything. Apple against the index *fell* from 0.80 to 0.70, and the small-cap against the index went to −0.03. The comfortable version of this lesson is too strong, and the specific version is more useful.",
      },
      {
        id: "gold-worked",
        label:
          "Nothing surprising — gold held up, which is what a diversified book is supposed to do.",
        note: "Gold did hold up, falling 15.9% against the index's 34.1%. But it also went from 0.08 to 0.24 against the index and 0.12 to 0.37 against Bitcoin, so it diversified less than its average said it would.",
      },
      {
        id: "averages-fine",
        label:
          "The averages were right — one bad quarter does not overturn 1,429 days of measurement.",
      },
    ],
  },
  target: { correct: ["hedge-failed"] },
  tolerance: {},
  stars: [0.5, 0.9, 1],
  misconceptions: [
    {
      id: "correlation-took-the-slogan",
      test: (attempt) => attempt.selected.includes("all-to-one"),
      message:
        "Close, and the absolute version is measurably false — which matters, because a rule that is wrong in the general case gets discarded along with the useful part. Apple against the index went *down*, 0.80 to 0.70, and the small-cap went to −0.03. What rose is the set of pairs everyone counts as diversifying: Bitcoin against the index, Bitcoin against gold, gold against the index. The things you were relying on, not everything.",
    },
    {
      id: "correlation-defended-the-average",
      test: (attempt) => attempt.selected.includes("averages-fine"),
      message:
        "The average is not wrong, it is answering a different question. Across 1,429 days Bitcoin and the index really do correlate at 0.28, and on the 142 days the index fell hardest they correlate at 0.46 — both are true. The one you need is the second, because that is when the position size matters and when an account is lost. An average over a period that includes the disaster tells you very little about the disaster.",
    },
    {
      id: "correlation-only-looked-at-gold",
      test: (attempt) => attempt.selected.includes("gold-worked"),
      message:
        "Gold did its job better than anything else here, so this is a reasonable read. What it misses is the asset that failed: Bitcoin was the uncorrelated one on paper — 0.01 against the index on ordinary days, which is as diversifying as a number gets — and it fell 53.6% while the index fell 34.1%. A hedge that works on quiet days is not a hedge.",
    },
  ],
  hints: [
    "Set the axis to percent and compare the depth of the four falls.",
    "Which of these four was the one you would have called uncorrelated a month earlier?",
  ],
};
