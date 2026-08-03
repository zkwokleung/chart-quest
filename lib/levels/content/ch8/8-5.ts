import type { Level } from "../../schema";

/**
 * A backtest report, and the four sentences in it that the data does not support.
 *
 * `spot-the-flaw` on an artefact that is not a chart — the case the kind was held back for
 * through three deferrals. Every figure the report quotes is real, taken from
 * `public/data/asset-character.json`, which is what makes the level hard: nothing here is a
 * lie, and four of the seven claims still do not follow.
 *
 * The measurements, all reproduced in the claims test:
 *
 *   557 trades, six markets, 2005-2025, +157.2R pooled, +0.282 per trade
 *   per trade   AAPL +0.522   GC +0.328   BTC +0.300   SPY +0.215   LAKE +0.115   EUR +0.010
 *   Apple alone: 43% of the total R from 23% of the trades
 *   41 losing market-years; only 3 of 21 years were positive on every market that traded
 *
 * ## Which claims are flawed, and why each is the *kind* of thing that gets past people
 *
 * `all-six` — profitable on all six, therefore the edge is in the rule. True premise, false
 * inference: per-trade R spreads fiftyfold, so the rule is a rounding error on one market and a
 * business on another. "It works everywhere" and "it works equally everywhere" are one word
 * apart.
 *
 * `euro-robust` — the euro proves it travels. +0.7R across 69 trades over eighteen years is
 * indistinguishable from not having traded, and calling it confirmation is how a flat result
 * gets counted as a win.
 *
 * `crypto-theory` — it works best on the trend-persistent market, as theory predicts. Bitcoin
 * is **third** of six, and Apple, second on persistence, pays most. The claim is doubly bad: it
 * gets the fact wrong *and* dresses it as a prediction confirmed, which is the shape of every
 * story told after the fact.
 *
 * `every-year` — profitable in every year tested. The pooled total is positive every year, and
 * 41 individual market-years lost money. Aggregating across markets hides exactly what the
 * chapter is about.
 *
 * `concentration` is **sound and damning**, which is why it is in the list: a player who marks
 * it has learned to distrust the report rather than to read it, and `f1` scoring makes that
 * cost something. Same for `sample` and `total`, which are simply true.
 *
 * ## Divergence from the spec, and an authoring rule that had to change
 *
 * `CURRICULUM.md` asked for "regime shift — the same rule through 2017, 2018, 2020, 2022". The
 * by-year table is in the reveal and is better as evidence than as a subject: 2022 is negative
 * on three of six markets rather than on all of them, so "the year explains everything" would
 * have been another overclaim in a chapter that cannot afford one.
 *
 * `AUTHORING.md` required every flawed claim to carry a `signal`, which over-fits 6.5 where the
 * flaw is redundancy between indicator readings. Here the flaw is a false inference from a true
 * number, and there is no signal to name. The rule is amended to what it always meant: a flawed
 * claim must be **recomputable** — by a `signal` where the flaw is redundancy, and by the
 * chapter's claims test otherwise.
 */
export const level: Level<"spot-the-flaw"> = {
  id: "8-5",
  chapter: 8,
  title: "The report, and what it leaves out",
  kind: "spot-the-flaw",
  brief:
    "Someone has backtested the breakout rule you have been measuring all chapter and written it up. Every number in this report is real — none of it is invented, and you can check all of it. Four of the seven sentences still do not follow from it. This is what a plausible strategy write-up looks like from the inside.",
  data: [{ series: "SPY-1d", from: 4280, to: 4530, label: "S&P 500 · 2022" }],
  config: {
    prompt:
      "Every figure below is measured and correct. Mark the claims that do not follow from it.",
    claims: [
      {
        id: "sample",
        label: "Tested over 557 trades on six markets across twenty-one years.",
        note: "True, and a real sample. Chapter 4's habit was to check this first, and here it holds up.",
      },
      {
        id: "total",
        label: "It made +157.2R in total, a little over a quarter of an R per trade.",
        note: "True. Both figures are the pooled measurement.",
      },
      {
        id: "all-six",
        label:
          "It was profitable on all six markets, so the edge is in the rule rather than in one lucky market.",
        note: "The premise is true and the conclusion is not. Per trade it ranges from +0.522R to +0.010R — fiftyfold. 'It works everywhere' and 'it works equally everywhere' are one word apart.",
      },
      {
        id: "euro-robust",
        label:
          "It even made money on the euro, which confirms it travels across asset classes.",
        note: "+0.7R across 69 trades in eighteen years. That is not travelling; it is standing still while being counted as a win.",
      },
      {
        id: "crypto-theory",
        label:
          "It performs best on Bitcoin, the most trend-persistent market — exactly as the theory predicts.",
        note: "Bitcoin is third of six at +0.300R. Apple pays most at +0.522R. The fact is wrong and it is dressed as a prediction confirmed, which is the shape of most stories told afterwards.",
      },
      {
        id: "concentration",
        label: "Apple alone produced 43% of the total return, from 23% of the trades.",
        note: "True — and it is the sentence that dismantles the third claim. Marking it costs you, because learning to distrust a report is not the same as learning to read one.",
      },
      {
        id: "every-year",
        label: "It was profitable in every year it was tested.",
        note: "True of the pooled total and false of the thing that matters: 41 individual market-years lost money, and only 3 of 21 years were positive on every market trading in them.",
      },
    ],
  },
  target: { flawed: ["all-six", "euro-robust", "crypto-theory", "every-year"] },
  tolerance: {},
  stars: [0.5, 0.75, 0.95],
  misconceptions: [
    {
      id: "report-marked-everything",
      test: (attempt) => attempt.flagged.length >= 6,
      message:
        "Marking almost everything is not scepticism, it is refusing to read. Three of these sentences are straightforwardly true, and one of them — that Apple produced 43% of the return from 23% of the trades — is the most useful line in the report, because it is what makes the third claim collapse. A reviewer who cannot tell a true statement from a false inference cannot review anything.",
    },
    {
      id: "report-accepted-all-six",
      test: (attempt) => !attempt.flagged.includes("all-six"),
      message:
        "'Profitable on all six, so the edge is in the rule' is the flaw this chapter was built to catch. The premise is true. The conclusion needs the six results to be *similar*, and they range from +0.522R a trade to +0.010R. On the euro this rule is a rounding error; on Apple it is a business. Both are 'profitable'.",
    },
    {
      id: "report-accepted-every-year",
      test: (attempt) => !attempt.flagged.includes("every-year"),
      message:
        "The pooled total was positive every year, so the sentence is not a lie — it is an aggregate hiding its own composition. Forty-one separate market-years lost money, and only three of twenty-one years were positive across every market that traded. Adding six markets together and reporting the sum is how a strategy with two good markets and four mediocre ones becomes 'robust'.",
    },
  ],
  hints: [
    "Every number is true. Look at what each sentence concludes from its number.",
    "One of the true sentences contradicts one of the conclusions. Find that pair first.",
  ],
};
