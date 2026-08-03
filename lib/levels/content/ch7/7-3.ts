import type { Level } from "../../schema";

/**
 * **The level that makes this chapter transfer.** One trade, four markets, one formula.
 *
 * Every row is the same account, the same one percent, and a stop two percent below entry. The
 * only thing that changes is what the instrument does to a price move — and the four answers are
 * a fractional coin, a few hundred shares, a fraction of a lot, and *zero contracts*.
 *
 * That last one is not a bug and the level says so. Gold is 100 ounces a contract, so a 2% stop on
 * a 1,900-dollar contract risks 3,800 dollars against a 500-dollar budget. One contract is more
 * than the account can carry, and the correct answer is that you do not take the trade in that
 * instrument at that size. A player who writes 13 has computed the ounces and forgotten the
 * contract, which is the error the misconception names.
 *
 * `data: []` on purpose. Sizing is arithmetic over a spec, so there is no window to show — and
 * naming no series is what lets this level use gold while 7.B runs on gold.
 *
 * Answers are derived by `sizePosition` from `lib/instruments/specs.ts`, whose contract terms are
 * exchange specifications rather than measurements, cited there as such.
 */
export const level: Level<"sizing-calc"> = {
  id: "7-3",
  chapter: 7,
  title: "The same trade, four markets",
  kind: "sizing-calc",
  brief:
    "Fifty thousand dollars, one percent of risk, and a stop two percent below entry — the same trade four times, in four kinds of market. The formula does not change. The answers are nothing like each other, and one of them is zero.",
  data: [],
  config: {
    prompt:
      "Risking 1% of 50,000 with a stop 2% below entry, what size do you take in each?",
    equity: 50_000,
    riskPct: 0.01,
    answer: "units",
    positions: [
      { instrument: "BTCUSDT-1d", entry: 50_000, stop: 49_000, label: "Bitcoin · spot, fractional" },
      { instrument: "AAPL-1d", entry: 200, stop: 196, label: "Apple · whole shares" },
      { instrument: "GC-1d", entry: 1_900, stop: 1_862, label: "Gold · 100-ounce contracts" },
      { instrument: "EURUSD-1d", entry: 1.1, stop: 1.078, label: "Euro · 100,000-unit lots" },
    ],
  },
  target: {},
  tolerance: { relative: 0.02 },
  stars: [0.5, 0.75, 0.95],
  misconceptions: [
    {
      id: "transfer-forgot-the-gold-multiplier",
      test: (attempt) => {
        const gold = attempt.values[2];
        return gold !== null && gold !== undefined && gold >= 10 && gold <= 20;
      },
      message:
        "Thirteen is the number of *ounces* the budget buys, and gold does not trade in ounces — it trades in contracts of a hundred. Thirteen contracts is 1,300 ounces and risks 49,400 dollars against a 500-dollar budget. This is the single most expensive arithmetic error in the chapter, and it is why `valuePerPoint` exists.",
    },
    {
      id: "transfer-would-not-write-zero",
      test: (attempt) => {
        const gold = attempt.values[2];
        return gold !== null && gold !== undefined && gold > 0 && gold < 1;
      },
      message:
        "There is no fractional gold contract — the smallest position is one, and one risks 3,800 dollars when the budget is 500. The honest answer is zero: at this account size, with this stop, gold is an instrument you cannot trade to your own rules. Recognising that is the skill, not finding a number that fits.",
    },
    {
      id: "transfer-same-size-across-markets",
      test: (attempt) => {
        const given = attempt.values.filter((v): v is number => v !== null);
        return given.length >= 3 && new Set(given).size <= 2;
      },
      message:
        "Four markets cannot take the same size, because a one-point move is worth one dollar on a share, a hundred on a gold contract and a hundred thousand on a euro lot. The formula is identical in all four; the instrument's own numbers are what make the answers differ, and that is the whole of what transfers.",
    },
  ],
  hints: [
    "Work out what one point of price is worth on each instrument before dividing anything.",
    "One of the four answers is zero, and it is not a trick.",
  ],
};
