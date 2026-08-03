import type { Level } from "../../schema";

/**
 * Twenty-four trades, and the one number that says whether they were worth taking.
 *
 * ## Where the trades come from
 *
 * Chapter 7 measured its rule sequentially on SPY and found a run of thirteen consecutive
 * losses. This is the same rule on the same market across a wider stretch — the first
 * twenty-four trades it took — and the point is that the list *looks* bad. Nine winners against
 * fifteen losers is a 37.5% hit rate, which is the number a player fixates on, and the
 * expectancy is positive anyway.
 *
 * The R values are the shipped measurement rather than invented: ten of the losses sit at
 * exactly −1.00 because the stop held, and two are worse because 2008 gapped through it. 1.6
 * taught that a stop does not protect across a gap; this is the level where it shows up in the
 * arithmetic rather than in a chart.
 *
 * ## Why `sizing-calc` rather than a new kind
 *
 * The kind's identity is *type a number, derived from config rather than authored, graded on
 * relative tolerance*, and an expectancy is exactly that. `answersFor` gained one branch and
 * stays the single source the grader, `perfectAttempt` and this chapter's claims test all call —
 * so the answer cannot be typed into this file and then disagree with the grader.
 *
 * The rejection that produced `probe` in M8 was structural rather than a matter of taste:
 * `tune-param.config` literally *is* `(value) => IndicatorSpec`, and no widening turns that into
 * a table of markets. Nothing is being bent out of shape here.
 *
 * ## The tolerance
 *
 * Two percent relative, on an answer of +0.146R. That is tight in absolute terms and it should
 * be: this is arithmetic with no judgement in it, and a player who divides correctly gets it
 * exactly. The judgement is in believing the result — which the misconceptions are for.
 */
export const level: Level<"sizing-calc"> = {
  id: "9-1",
  chapter: 9,
  title: "Was it worth taking",
  kind: "sizing-calc",
  brief:
    "Twenty-four trades from the rule you traded all through Chapter 7, on the index, in order. Nine of them won. Fifteen lost. Before you decide whether that is a strategy or a slow way to lose money, work out the one number that answers it.",
  data: [],
  config: {
    prompt:
      "What did the average trade return, in R? That is the expectancy — and it is the only figure here that decides anything.",
    // Unused by `expectancy`, but the schema carries one account per level.
    equity: 25_000,
    riskPct: 0.01,
    answer: "expectancy",
    positions: [],
    // The rule's first twenty-four trades on SPY-1d, in order. Ten losses at exactly −1.00R
    // where the stop held; −1.06 and −1.03 where price gapped through it.
    outcomes: [
      { r: 2.0, label: "target" },
      { r: -1.0 },
      { r: -1.0 },
      { r: 2.0, label: "target" },
      { r: -1.0 },
      { r: 2.14, label: "gapped past the target" },
      { r: -1.0 },
      { r: -1.0 },
      { r: 2.0, label: "target" },
      { r: -1.0 },
      { r: -1.06, label: "gapped through the stop" },
      { r: -1.0 },
      { r: 2.0, label: "target" },
      { r: -1.0 },
      { r: -1.0 },
      { r: 2.0, label: "target" },
      { r: -1.03, label: "gapped through the stop" },
      { r: -1.0 },
      { r: 2.0, label: "target" },
      { r: -1.0 },
      { r: -1.0 },
      { r: 2.0, label: "target" },
      { r: -1.0 },
      { r: 2.46, label: "gapped past the target" },
    ],
  },
  target: {},
  tolerance: { relative: 0.02 },
  stars: [0.5, 0.75, 0.95],
  misconceptions: [
    {
      id: "expectancy-read-the-win-rate",
      test: (attempt) => {
        const given = attempt.values[0];
        return given !== null && given !== undefined && Math.abs(given - 0.375) < 0.05;
      },
      message:
        "That is the win rate — nine of twenty-four, 37.5% — and it is the number that makes this list look like a failure. It is also the number that cannot answer the question on its own. Winning 37.5% of the time at two-to-one is profitable; winning 60% at one-to-three is not. Only the average trade knows which you have.",
    },
    {
      id: "expectancy-counted-the-total",
      test: (attempt) => {
        const given = attempt.values[0];
        return given !== null && given !== undefined && given > 2;
      },
      message:
        "That looks like the total rather than the average. The total tells you what this particular run of twenty-four did; the average tells you what the next trade is worth, which is the only one you can still decide about. Divide by the number of trades.",
    },
    {
      id: "expectancy-is-thin-and-that-is-the-point",
      test: () => false,
      message:
        "About +0.15R a trade — real, positive, and thin. Fifteen losses out of twenty-four to earn it, and two of those losses ran past the 1R the stop promised because price gapped through it, which is 1.6's lesson arriving in the arithmetic. A positive expectancy is not a comfortable one, and this is what the rules in this game actually look like from the inside.",
    },
  ],
  hints: [
    "Add every R together, then divide by how many trades there were.",
    "The answer is positive, and smaller than you would want it to be.",
  ],
};
