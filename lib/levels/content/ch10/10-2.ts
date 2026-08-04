import type { Level } from "../../schema";

/**
 * A hypothesis you could be wrong about, told apart from one you could not.
 *
 * ## Why `classify` rather than free text, and why it is graded on the engine
 *
 * `CURRICULUM.md` asks for "a falsifiable edge hypothesis (structured, not free text)". Structured is
 * the operative word: a text box would need a grader that reads English, and this project's rule is
 * that a graded answer must be measurable rather than a matter of taste — the amendment 8.5 forced on
 * `AUTHORING.md`.
 *
 * So falsifiability is made **mechanical**: a hypothesis is falsifiable here if and only if the engine
 * the player is about to use could return a result that contradicts it. That is not a philosophical
 * test, it is a question about `Block`, `Objective` and `runStrategy` — and it is checkable, which is
 * what lets the level be graded at all.
 *
 * Each option is exactly one of:
 *
 * - **Testable**: expressible as blocks plus an objective, so a run can refute it. Two of these.
 * - **Not testable**: true whatever happens, or about something the engine cannot see.
 *
 * ## The one that catches people
 *
 * "Buying dips in an uptrend beats doing nothing" is the hypothesis the rest of the chapter tests, and
 * it sounds the least ambitious of the four. It is the only one with a stated comparison, which is
 * exactly what makes it refutable — and Chapter 10 has already measured that the comparison matters:
 * entering on every bar with the same exit pays +0.27R a trade on the index, so a hypothesis without a
 * baseline is one that success cannot fail to confirm.
 */
export const level: Level<"classify"> = {
  id: "10-2",
  chapter: 10,
  title: "Something you could be wrong about",
  kind: "classify",
  brief:
    "Before you build anything, say what you think is true — in a form the backtest could contradict. Two of these four are things the engine you are about to use could prove wrong. The other two would survive any result it produced, which is a different kind of statement and a much less useful one.",
  config: {
    prompt: "Which of these could your backtest refute? Choose both.",
    multiple: true,
    options: [
      {
        id: "dip-beats-nothing",
        label:
          "Buying a dip inside an uptrend beats entering at no reason at all, on the same market with the same exit.",
        note: "Testable, and it is the hypothesis this chapter goes on to test. It names a rule, a comparison and a market, so a run can come back and say no — which it does on Bitcoin.",
      },
      {
        id: "breakout-30-trades",
        label:
          "A twenty-bar breakout produces a positive expectancy over at least thirty trades on the index.",
        note: "Testable. Every term is something the engine measures, and the trade count is stated — so 'it worked but only nine times' cannot be counted as a pass.",
      },
      {
        id: "risk-management-matters",
        label: "Good risk management is more important than a good entry.",
        note: "Not testable as written, and it is probably true — which is the trap. There is no rule here, no comparison and no number, so no run could contradict it. Chapter 7 made the measurable version of this claim: 7.B's reckless player finishes richer and scores worse.",
      },
      {
        id: "market-will-trend",
        label: "This market will trend for the next six months, so a trend rule should work.",
        note: "Not testable by a backtest at all: it is a forecast, and the engine only ever runs on bars that already happened. 1.B was built to break the instinct behind it — you scored about 50% calling five bars.",
      },
    ],
  },
  data: [],
  target: { correct: ["dip-beats-nothing", "breakout-30-trades"] },
  tolerance: {},
  stars: [0.5, 0.75, 1],
  misconceptions: [
    {
      id: "ch10-true-is-not-testable",
      test: (attempt) => attempt.selected.includes("risk-management-matters"),
      message:
        "'Good risk management matters more than a good entry' is very likely true, and that is why it is here. Ask what result would make you abandon it — there is none, because it names no rule, no comparison and no number. A hypothesis that cannot fail cannot teach you anything, and 8.5's report was seven sentences of exactly this shape.",
    },
    {
      id: "ch10-forecast-is-not-hypothesis",
      test: (attempt) => attempt.selected.includes("market-will-trend"),
      message:
        "A backtest runs on bars that have already happened, so 'this market will trend for six months' is not something it can be wrong about — it can only be wrong later, when it is too late to have mattered. Chapter 1's boss put you at roughly 50% calling five bars, and 9.2 showed that 3.1% of coin-flippers manage five out of five and every one of them has an explanation.",
    },
    {
      id: "ch10-needs-a-comparison",
      test: (attempt) =>
        attempt.selected.includes("dip-beats-nothing") &&
        !attempt.selected.includes("breakout-30-trades"),
      message:
        "You found the harder one. The other is testable for the same reason and one more: it states a trade count. Without one, 'positive expectancy on the index' can be reported off nine trades — and 10.6 is about to hand you exactly nine and ask what they prove.",
    },
  ],
  hints: [
    "For each one, ask: what result would make me abandon this?",
    "Two of them name a comparison or a number. Two of them name neither.",
  ],
};
