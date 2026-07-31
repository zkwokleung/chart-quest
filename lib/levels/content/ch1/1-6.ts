import type { Level } from "../../schema";

/**
 * The same weeks of March 2020 in three markets, ordered by session length.
 *
 * Measured over these windows, gap being an open more than 0.5% from the previous
 * close:
 *
 *   SPY   6.5h a day    15 of 17 gapped   largest −10.45% on 2020-03-16
 *   GC    ~23h, 5 days  10 of 17 gapped   largest  +3.52% on 2020-03-16
 *   BTC   24/7           0 of 21 gapped   largest   0.06%
 *
 * The frequencies overlap; the **magnitudes** do not, and it is magnitude that a
 * stop cares about. Three orders of session length give 10.45%, 3.52% and 0.06%,
 * and the lesson is not that gaps exist but what they cost: a stop sitting inside a
 * gap does not fill at its price, because no trade happened there.
 *
 * **The third chart was EURUSD-1d and is gold futures instead.** Yahoo's `EURUSD=X`
 * feed reports an open within a pip or two of the *same bar's* close for everything
 * after 2010 — 72% of that series has a body under a tenth of its range, against
 * ~11% for every other series we hold, and 64 of the last 67 upstream bars have the
 * same defect. So the FX "gaps" this level used to show were not gaps between
 * sessions at all; they were each bar's own move, relabelled. Gold futures trade
 * nearly around the clock, stop for the weekend, and have a sound open, so they
 * make the same point with data that means what it says. `lib/data/integrity.test.ts`
 * now fails on any other series with that shape.
 */
export const level: Level<"classify"> = {
  id: "1-6",
  chapter: 1,
  title: "Four clocks",
  kind: "classify",
  brief:
    "March 2020, three markets, the same weeks. One of them jumps between bars; another barely does. The difference is when each market is open.",
  data: [
    { series: "SPY-1d", from: 3818, to: 3836, label: "SPY · US shares, 6.5h a day" },
    { series: "GC-1d", from: 3810, to: 3828, label: "GC · gold futures, 23h a day" },
    { series: "BTCUSDT-1d", from: 933, to: 955, label: "BTCUSDT · crypto, 24/7" },
  ],
  config: {
    prompt:
      "SPY opens away from its previous close on 15 of these 17 days, once by 10.4%. Gold's worst jump is 3.5%; Bitcoin's is 0.1%. What does that mean for a stop order?",
    options: [
      {
        id: "no-protection",
        label:
          "A stop inside a gap cannot fill at its price — no trade happened there, so it fills at the open, wherever that is.",
        note: "This is why a 2% stop can lose 10% overnight.",
      },
      {
        id: "always-fills",
        label: "Nothing — a stop always fills at the price you set.",
      },
      {
        id: "crypto-riskier",
        label:
          "That crypto is the riskier market here, since continuous trading means no pauses.",
      },
      {
        id: "gaps-fill",
        label: "Gaps always get filled later, so the stop evens out.",
      },
    ],
  },
  target: { correct: ["no-protection"] },
  tolerance: {},
  stars: [0.5, 0.9, 1],
  misconceptions: [
    {
      id: "believes-stops-guarantee-price",
      test: (attempt) => attempt.selected.includes("always-fills"),
      message:
        "A stop is an instruction to sell at the market once a price is touched, not a guarantee of that price. When SPY opened 10.4% lower on 16 March, every stop between the two closes filled at the open.",
    },
    {
      id: "inverted-the-risk",
      test: (attempt) => attempt.selected.includes("crypto-riskier"),
      message:
        "On this specific risk it is the other way round. Continuous trading is what removes the gap — there is no closed period for price to jump across.",
    },
    {
      id: "gap-fill-folklore",
      test: (attempt) => attempt.selected.includes("gaps-fill"),
      message:
        "Some gaps are filled and some are not, and 'later' can be years. Either way it does not help a stop that already filled at the open.",
    },
  ],
  hints: [
    "Compare each chart's opens against the previous bar's close.",
    "Ask what price your order can actually trade at, if nobody traded overnight.",
  ],
};
