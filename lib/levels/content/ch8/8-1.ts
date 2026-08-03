import type { Level } from "../../schema";

/**
 * Five markets, the same ten percent, five different events.
 *
 * The windows are chosen against two constraints at once, and the second is what makes the
 * level fair. Each moved within half a point of **+10% net** across seventy bars — and each
 * did it at a volatility **typical for that market**, within 3% of its own median 14-bar ATR:
 *
 *   BTCUSDT  2520-2590  +9.78%   window 4.50% ATR, median 4.60%   =  2.0 ATR
 *   LAKE     2287-2357  +9.86%   window 3.71%, median 3.69%       =  2.4 ATR
 *   GC       1544-1614  +9.55%   window 1.14%, median 1.15%       =  7.6 ATR
 *   SPY      4071-4141  +10.58%  window 1.13%, median 1.11%       =  8.5 ATR
 *   EURUSD   3184-3254  +9.64%   window 0.74%, median 0.82%       = 11.8 ATR
 *
 * Without the typicality constraint the level would have lied. The first search found a 2008
 * euro window and a 2011 index window, both crises, where the euro's ten percent measured 7.2
 * ATR against the index's 9.2 — the wrong answer, produced by comparing two unusual periods
 * rather than two markets. Cherry-picking a calm window for one market and a wild one for
 * another is the easiest way to make this level say whatever an author wants, so the claims
 * test asserts every window is representative.
 *
 * **Six times the event, for the same headline number.** Ten percent is a fortnight's noise on
 * Bitcoin and a once-a-year move on the euro. That is the whole of what the y-axis toggle is
 * for, and this is the level where it stops being a control and becomes an argument — which is
 * why Chapter 8 is where the toggle turns on everywhere.
 *
 * **`classify`, and no new kind.** A chart plus a choice is a `classify`; the fifth time this
 * repo has made that call. The interaction the level needs already exists in `YAxisToggle`,
 * and `Classify` already renders `data.map()` into a grid, so five panes cost nothing.
 *
 * Apple is absent on purpose. It is Chapter 8's boss asset, and the guard that keeps it that
 * way compares *displayed slices* — so no level in this chapter may name `AAPL-1d` in `data`,
 * at any window.
 *
 * **Not a repeat of 5.5.** That level asks what a hypothetical 3% day *would* mean on three
 * markets, from a table. This shows five real windows that each already moved ten percent and
 * asks which of them was an event. One is arithmetic about volatility; this is reading it.
 */
export const level: Level<"classify"> = {
  id: "8-1",
  chapter: 8,
  title: "Ten percent of what",
  kind: "classify",
  brief:
    "Five markets, and every one of these windows moved about ten percent. Same headline number, five different stories — and each of these periods was ordinary for the market it belongs to, so this is not a trick of picking a calm month here and a wild one there. Switch the axis to ATR and ask which of them was actually a big move.",
  data: [
    { series: "BTCUSDT-1d", from: 2520, to: 2590, label: "Bitcoin · daily" },
    { series: "LAKE-1d", from: 2287, to: 2357, label: "Small-cap · daily" },
    { series: "GC-1d", from: 1544, to: 1614, label: "Gold · daily" },
    { series: "SPY-1d", from: 4071, to: 4141, label: "S&P 500 · daily" },
    { series: "EURUSD-1d", from: 3184, to: 3254, label: "Euro · daily" },
  ],
  config: {
    prompt: "Same move, five markets. On which was ten percent the biggest event?",
    options: [
      {
        id: "euro",
        label: "The euro — ten percent is nearly twelve times its daily range.",
        note: "Correct, and measured: 11.8 ATR, against 2.0 on Bitcoin. The euro's typical day spans 0.82% of its price, so a ten percent move takes a long time and means something.",
      },
      {
        id: "bitcoin",
        label:
          "Bitcoin — it is the most volatile market here, so its moves are the biggest.",
        note: "It is the most volatile, which is exactly why ten percent is small *for it*: 2.0 ATR, or about two ordinary days. Volatility is the denominator, not the answer.",
      },
      {
        id: "smallcap",
        label: "The small-cap — thin markets make every move violent.",
        note: "Its typical day spans 3.69%, second only to Bitcoin, so ten percent is 2.4 ATR here. Thin does mean violent, and violent means ten percent is unremarkable.",
      },
      {
        id: "same",
        label: "All the same — ten percent is ten percent whichever market it happens in.",
      },
    ],
  },
  target: { correct: ["euro"] },
  tolerance: {},
  // A single choice from five panes, so a wrong answer is a real misreading rather than a slip.
  stars: [0.5, 0.9, 1],
  misconceptions: [
    {
      id: "character-mistook-volatility-for-size",
      test: (attempt) =>
        attempt.selected.includes("bitcoin") || attempt.selected.includes("smallcap"),
      message:
        "You picked the most volatile market, and volatility is what you divide by rather than what you answer with. Bitcoin's typical day spans 4.6% of its price, so ten percent is barely two of them — a quiet fortnight. The euro's day spans 0.82%, so the same ten percent is nearly twelve, which is why the euro chart looks like something happened and the Bitcoin chart looks like a Tuesday.",
    },
    {
      id: "character-ten-percent-is-ten-percent",
      test: (attempt) => attempt.selected.includes("same"),
      message:
        "It is the same arithmetic and not the same event, and the gap is almost six-fold: 2.0 ATR on Bitcoin against 11.8 on the euro. This is the reason every measurement in this game has been in ATR multiples since Chapter 5 — a percentage tells you what happened to the price, and a multiple of the market's own range tells you whether that was unusual. Only the second one transfers.",
    },
    {
      id: "character-did-not-change-the-axis",
      test: () => false,
      message:
        "The axis control above each chart is the point of this level. On the price axis these five are five unrelated pictures; on the ATR axis they are directly comparable, and the answer is visible without arithmetic. From here the control is on every chart in the game.",
    },
  ],
  hints: [
    "Switch the axis from price to ATR and compare the five again.",
    "Ask how many ordinary days each market would need to travel ten percent.",
  ],
};
