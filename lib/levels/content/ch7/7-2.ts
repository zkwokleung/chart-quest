import type { Level } from "../../schema";

/**
 * Sizing a fractional instrument, where the answer is not a whole number.
 *
 * No chart and no series named: this is arithmetic over a contract spec, so a window would add
 * nothing, and it keeps the level out of the cross-asset boss guard — which is what lets 7.3 use
 * gold while 7.B runs on gold.
 *
 * The answer comes from `sizePosition`, not from this file. All three rows are the same account
 * and the same 1%, so the only thing moving is the stop distance — and the sizes move inversely
 * with it, which is the relationship the whole chapter turns on.
 */
export const level: Level<"sizing-calc"> = {
  id: "7-2",
  chapter: 7,
  title: "How much is one percent",
  kind: "sizing-calc",
  brief:
    "Twenty-five thousand dollars, and a rule that says never risk more than one percent of it on one trade. That is two hundred and fifty dollars. Bitcoin trades in fractions, so the position will not be a whole number — work out how much of it to buy.",
  data: [],
  config: {
    prompt:
      "Risking 1% of the account, how much Bitcoin do you buy? Three stops, three answers.",
    equity: 25_000,
    riskPct: 0.01,
    answer: "units",
    positions: [
      { instrument: "BTCUSDT-1d", entry: 50_000, stop: 48_000, label: "Stop 2,000 below" },
      { instrument: "BTCUSDT-1d", entry: 50_000, stop: 49_000, label: "Stop 1,000 below" },
      { instrument: "BTCUSDT-1d", entry: 50_000, stop: 49_500, label: "Stop 500 below" },
    ],
  },
  target: {},
  tolerance: { relative: 0.02 },
  stars: [0.5, 0.75, 0.95],
  misconceptions: [
    {
      id: "size-spent-the-budget",
      test: (attempt) =>
        attempt.values.some(
          (value) => value !== null && Math.abs(value - 250 / 50_000) < 1e-4,
        ),
      message:
        "That is 250 dollars' worth of Bitcoin, which is not the same as a position that loses 250 dollars. The budget is what you lose when the stop is hit, not what you spend — and the difference between the two is the stop distance, which is the only number that changed between these three rows.",
    },
    {
      id: "size-did-not-move-with-the-stop",
      test: (attempt) => {
        const given = attempt.values.filter((v): v is number => v !== null);
        return given.length >= 2 && new Set(given).size === 1;
      },
      message:
        "The same size three times cannot be right. A closer stop means less lost per coin, so the same 250 dollars buys more of them: halving the stop distance doubles the position. That inverse relationship is the formula — and it is why a tighter stop is not automatically a smaller risk.",
    },
    {
      id: "size-rounded-to-a-whole-coin",
      test: (attempt) =>
        attempt.values.some((value) => value !== null && value >= 1 && Number.isInteger(value)),
      message:
        "A whole coin at fifty thousand dollars with a two-thousand-dollar stop risks two thousand — eight times the budget. Bitcoin divides to eight decimal places, so there is no reason to round up to something the account cannot afford.",
    },
  ],
  hints: [
    "One percent of 25,000 is 250. How many coins lose exactly that when the stop is hit?",
    "Divide the money you may lose by the money you lose per coin.",
  ],
};
