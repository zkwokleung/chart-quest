import { barMark } from "../../mark";
import type { Level } from "../../schema";

/**
 * Boss: EURUSD-1h 694-786 with EURUSD-4h 155-193 above it, trigger bar 754
 * (2025-04-29 17:00).
 *
 * **Not AAPL + SPY, and the spec is not buildable as written.** CURRICULUM.md puts 6.B on
 * "AAPL + SPY", which is two *instruments* rather than two timeframes — and AAPL has no
 * intraday series at all, so there is no second view of it to set beside the daily. A
 * multi-timeframe boss needs one instrument seen twice.
 *
 * EURUSD is the third pair, so the cross-asset rule holds: Chapter 6 teaches on BTCUSDT
 * (4h + 1d) and SPY (15m + 1h), and the boss runs on a market none of its levels used.
 * `EURUSD-4h` is resampled from the committed hourly series by `lib/data/resample.ts`.
 *
 * **It does not lean on trend structure, because EURUSD cannot carry that.** Requiring three
 * swing highs and three swing lows on both panes plus a label corroborated by the window's
 * own net move, the hourly/4h pair yields *zero* windows with a readable trend on both — its
 * 4h pane spans ten to twenty days, too short to establish one. So the boss rests on a level
 * and a trigger, which needs no multi-month bias.
 *
 * The setup: a 4h swing **high** at 1.14012 (4h bar 168), tested three times on the hour at
 * bars 740, 743 and 746, then rejected by a bearish reversal bar closing at 1.13882. ATR(14)
 * on the hour is 0.00206 — 0.181% of price.
 *
 * **A first draft put the level at 1.16023 and it was not in the pane.** That figure came
 * from a search that looked forty 4h bars back while the level displayed twenty-one, so the
 * swing it named sat off the left edge — a boss whose premise the player cannot see. The
 * search now requires the level to be a swing inside the window on screen, and 6.2 needed
 * the same correction.
 *
 * Simulated with a 2R target over the 30 bars the window leaves:
 *
 *   stop inside the level     1.13941   0.28× ATR total   −1.00R at +1 bar
 *   stop 0.15 ATR beyond      1.14043   0.78× ATR         +2.00R at +21 bars
 *   stop 0.60 ATR beyond      1.14135   1.23× ATR         +2.00R at +22 bars
 *   stop 0.80 ATR beyond      1.14177   1.43× ATR         +2.00R at +27 bars
 *   stop 1.00 ATR beyond      1.14218   1.63× ATR         +1.84R, target never reached
 *   stop 1.20 ATR beyond      1.14259   1.83× ATR         +1.64R, target never reached
 *
 * **Both ends punish**, which makes this the better of the chapter's two trades — 6.2's
 * window never punished width at all. The tolerances come from these numbers rather than from
 * 4.B's or 5.B's.
 *
 * The trade worked. 6.4 measured confluence at 24–28% across 4,223 setups whichever way you
 * stack it, so a trade like this one loses about as often as it wins, and the closing note
 * says so: the chapter's point is that the arithmetic has to survive the shape not paying.
 */
export const level: Level<"composite"> = {
  id: "6-B",
  chapter: 6,
  title: "Two timeframes, one trade",
  kind: "composite",
  brief:
    "The euro against the dollar, hourly, with the four-hour above it — a market no level in this chapter has used. Find where the slow chart turned, say what the fast one has to do, then trade it.",
  data: [
    { series: "EURUSD-1h", from: 694, to: 786, label: "EURUSD · 1h — the trade" },
    { series: "EURUSD-4h", from: 155, to: 193, label: "EURUSD · 4h — the level, for context only" },
  ],
  config: {
    steps: [
      {
        kind: "mark-bars",
        weight: 0.2,
        brief: "Find where price has been turned away",
        // Narrowed to the bars before the trigger, so this stage cannot see the outcome.
        // Step data may narrow a range but not change the series.
        data: [
          { series: "EURUSD-1h", from: 694, to: 755, label: "EURUSD · 1h" },
          { series: "EURUSD-4h", from: 155, to: 181, label: "EURUSD · 4h" },
        ],
        config: {
          prompt:
            "The four-hour chart turned at one price. On the hourly chart, click the three bars whose highs tested it.",
          mode: "bars",
          expected: 3,
        },
        target: { marks: [barMark(740), barMark(743), barMark(746)] },
        tolerance: { barSlop: 1 },
        misconceptions: [
          {
            id: "boss6-marked-lows",
            test: (attempt, lvl, data) => {
              const series = data[0];
              if (!series) return false;
              return attempt.marks.some((mark) => {
                const bar = Number(mark.replace("bar:", ""));
                const around = [bar - 2, bar - 1, bar, bar + 1, bar + 2];
                const lows = around.map((i) => series.l[i] ?? Infinity);
                return (series.l[bar] ?? Infinity) === Math.min(...lows);
              });
            },
            message:
              "Those are lows. The four-hour chart turned *down* at this price, so what tested it are highs — the bars where buyers got price up to the level and no further.",
          },
          {
            id: "boss6-marked-too-few",
            test: (attempt) => attempt.marks.length > 0 && attempt.marks.length < 3,
            message:
              "Price came back to this level three times before the bar that finally rejected it. A level tested once is a high; tested three times it is a price other people are also watching, which is what makes the fourth visit worth trading.",
          },
        ],
      },
      {
        kind: "classify",
        weight: 0.2,
        brief: "Say what the fast chart has to do",
        config: {
          prompt: "Price is back at the four-hour level. What are you waiting for?",
          options: [
            {
              id: "reversal-bar",
              label:
                "A bar on the hourly chart that rejects the level — so that if the idea fails, the failure is unambiguous.",
              note: "Correct. The trigger does not predict; it gives you a place where being wrong is cheap and obvious.",
            },
            {
              id: "confluence",
              label:
                "More confirmations — momentum, a moving-average cross, a wide range — before committing.",
              note: "6.4 measured that: three visible confirmations reached a 2R target 25% of the time, none 25%. Stacking them changed nothing.",
            },
            {
              id: "htf-close",
              label: "The four-hour bar to close back below the level.",
            },
          ],
        },
        target: { correct: ["reversal-bar"] },
        tolerance: {},
        misconceptions: [
          {
            id: "boss6-wanted-more-confluence",
            test: (attempt) => attempt.selected.includes("confluence"),
            message:
              "6.4 put a number on that instinct across 4,223 setups: three confirmations reached a 2R target 25% of the time, two 24%, one 28%, none 25% — every interval overlapping every other. And 6.5 showed why they do not add up, since most of them are the same reading in different units. Waiting for more of them costs you the entry and buys nothing.",
          },
          {
            id: "boss6-waited-for-the-slow-bar",
            test: (attempt) => attempt.selected.includes("htf-close"),
            message:
              "A four-hour close is four hours of information you already had by the end of the first hour, and by then the level is behind you. That is the whole reason for two panes: the slow one says where, the fast one says when.",
          },
        ],
      },
      {
        kind: "replay-trade",
        weight: 0.6,
        brief: "Take the trade",
        config: {
          prompt:
            "Short it at the retest. Place your stop and target, say why, and let it run.",
          side: "short",
          primeBars: 61,
          maxBars: 30,
          minRR: 2,
          atrPeriod: 14,
        },
        target: {
          structure: { shape: "level", price: 1.14012 },
          triggerBar: 754,
        },
        // Measured on this window. Inside the level the next hour takes the stop out; past
        // 0.8 ATR above it the 2R target moves further than these 30 bars travel, reaching
        // only +1.84R at 1.0 ATR.
        tolerance: { minAtr: 0.15, maxAtr: 0.8, barSlop: 2 },
        misconceptions: [
          {
            id: "boss6-stop-inside-the-level",
            test: (attempt, lvl) => {
              const structure = lvl.target.structure;
              if (structure.shape !== "level") return false;
              return attempt.stop < structure.price;
            },
            message:
              "Your stop sits below the four-hour high the trade is built on. A retest is allowed to touch the level — that is what a retest is — and a stop inside it was taken out by the very next hour here, on a move that disproved nothing.",
          },
          {
            id: "boss6-stop-too-wide",
            test: (attempt, lvl, data) => {
              const series = data[0];
              const entry = series?.c[lvl.target.triggerBar];
              if (entry === undefined) return false;
              // Beyond roughly 1.8 ATR of total risk on a 0.18%-ATR hourly chart.
              return attempt.stop - entry > 0.00206 * 1.8;
            },
            message:
              "At that width the two-to-one is further away than this window travels — the simulation reaches +1.84R and runs out of bars. Your target moves out with your risk, so a wider stop is not a safer trade; it is a longer bet on the same idea, and this one needed thirty hours as it was.",
          },
        ],
      },
    ],
  },
  target: {},
  tolerance: {},
  stars: [0.4, 0.7, 0.9],
  misconceptions: [
    {
      id: "boss6-incomplete",
      test: (attempt) => attempt.steps.some((step) => step === null),
      message:
        "Some stages are unanswered. All three are weighed, so a skipped stage counts as zero rather than being set aside.",
    },
    {
      id: "boss6-two-panes-one-idea",
      test: () => true,
      message:
        "This one paid, and 6.4 measured that stacking confirmations does not change the odds — so a trade like it loses about as often as it wins. Nothing you did here depended on it paying. The slow chart told you where to care, the fast chart told you when, and the stop told you what would prove you wrong. That division of labour is the whole of multi-timeframe trading; the rest of this chapter was about not counting the same fact twice on the way there.",
    },
  ],
  hints: [],
};
