import type { Level } from "../../schema";

/**
 * The same three weeks of March 2020 in three markets.
 *
 * Measured over these windows: 11 of SPY's 13 opens gapped away from the previous
 * close by more than 0.5%, the largest by 10.4% on 2020-03-16. EURUSD gapped on 7
 * of 13. Bitcoin gapped on 0 of 17, its largest being 0.1%.
 *
 * The lesson is not that gaps exist but what they cost: a stop sitting inside a
 * gap does not fill at its price, because no trade happened there.
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
    { series: "BTCUSDT-1d", from: 933, to: 955, label: "BTCUSDT · crypto, 24/7" },
    { series: "EURUSD-1d", from: 3930, to: 3948, label: "EURUSD · FX, 24/5" },
  ],
  config: {
    prompt:
      "SPY opens away from its previous close on 11 of these 13 days, once by 10.4%. Bitcoin does it on none. What does that mean for a stop order?",
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
