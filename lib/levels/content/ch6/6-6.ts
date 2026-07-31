import type { Level } from "../../schema";

/**
 * SPY-15m 0-78 — three consecutive sessions, and the opening range in each.
 *
 * **`classify`, not `mark-bars`, and the numbers decided that.** CURRICULUM.md asks the
 * player to mark session structure. Measured across all forty full sessions in the snapshot:
 *
 *   the session's widest bar is one of its first two   19 of 40
 *   both of the two widest are the opening pair         5 of 40
 *   median rank of the very first bar by width          3rd of 26
 *   opening two bars' share of summed bar width         13.1%  (they are 7.7% of the bars)
 *   sessions where the opening range held all day       1 of 40
 *
 * So the open is measurably busier than the rest of the session — a 1.7× concentration, and
 * the first bar is typically third-widest of twenty-six — but it is *not* reliably the
 * widest. A level asking the player to mark the widest bars would be wrong on more than half
 * of all sessions, which is not a level.
 *
 * What is reliable is the other number: the opening range broke on **39 of 40 sessions**, and
 * on the three shown here it broke after 7, 1 and 10 bars. The received idea — that the
 * opening range is a level worth trading breaks of — has the volatility right and the
 * durability exactly backwards. That is the level.
 *
 * The opening range's share of each day's total range on these three sessions is 37%, 28%
 * and 78%, so the "busier at the open" half is visible on the chart too.
 *
 * The BTC half of the specified comparison is not here. Bitcoin's finest committed timeframe
 * is four-hourly, which cannot resolve a thirty-minute range, so the claim "crypto has no
 * opening range" would have to be asserted rather than measured. 1.6 already established
 * that Bitcoin has no session at all, on gap data that *was* measured, and this level leans
 * on that rather than inventing a new unmeasurable comparison.
 */
export const level: Level<"classify"> = {
  id: "6-6",
  chapter: 6,
  title: "The first half hour",
  kind: "classify",
  brief:
    "Three sessions of SPY on fifteen-minute bars. The first two bars of each day are shaded in your mind's eye — that is the opening range, and on these three days it was 37%, 28% and 78% of everything the day went on to do.",
  data: [{ series: "SPY-15m", from: 0, to: 78, label: "SPY · 15m, three sessions" }],
  config: {
    prompt:
      "The opening range is where a lot of the day's movement happens. What is it worth as a level?",
    options: [
      {
        id: "busy-not-durable",
        label:
          "Very little. It tells you where the volatility is, not where price will stop — across forty sessions it was broken on thirty-nine.",
        note: "Correct. Both halves matter: the open really is busier, and the range it draws really does not hold.",
      },
      {
        id: "breakout",
        label:
          "A level to trade breaks of — when price leaves the opening range, that is the day's direction.",
        note: "It leaves on 39 of 40 sessions, usually within a few bars. A signal that fires almost every day is not selecting anything.",
      },
      {
        id: "support-resistance",
        label:
          "Support and resistance for the rest of the session, like any other level.",
      },
      {
        id: "nothing-special",
        label:
          "Nothing at all — the first half hour is no different from any other half hour.",
      },
    ],
  },
  target: { correct: ["busy-not-durable"] },
  tolerance: {},
  stars: [0.5, 0.9, 1],
  misconceptions: [
    {
      id: "session-opening-range-breakout",
      test: (attempt) => attempt.selected.includes("breakout"),
      message:
        "The opening range broke on 39 of the 40 sessions in this data, and on the three shown here it went after seven bars, one bar and ten bars. A condition that is met almost every day is not a filter — it is a description of what the market does before lunch. Chapter 4 measured the same failure in candlestick patterns: something that happens constantly cannot also be a signal.",
    },
    {
      id: "session-treated-it-as-a-level",
      test: (attempt) => attempt.selected.includes("support-resistance"),
      message:
        "A level earns the name by being respected, which is what 3.1 spent a whole level measuring. This one is respected for a handful of bars and then not: one session in forty saw the open's range survive the day. It is a container price starts in, not a boundary it defends.",
    },
    {
      id: "session-saw-nothing-in-it",
      test: (attempt) => attempt.selected.includes("nothing-special"),
      message:
        "Too far the other way. The opening two bars are 7.7% of a session and carry 13.1% of its summed bar range — a 1.7-fold concentration — and the first bar is typically the third-widest of twenty-six. The open genuinely is where the movement is. What it is not is a level.",
    },
  ],
  hints: [
    "Look at what price does immediately after the first two bars of each of the three sessions.",
    "Separate two questions: is the open volatile, and does the range it draws hold?",
  ],
};
