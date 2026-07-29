import { anchorQuality, anchorsOf, priceTolerance } from "@/lib/chart/geometry";
import { barMark } from "../../mark";
import type { Level } from "../../schema";

/**
 * Boss: EURUSD-1d 300-390 (2006-02-28 to 2006-07-02).
 *
 * A different market from every level in the chapter, which taught on Bitcoin
 * only. That is the point — a boss on a fresh asset is what shows the skill
 * transferred rather than the chart being memorised. The guard enforces it from
 * Chapter 2 onwards, Chapter 1 being exempt by design.
 *
 * Measured, and this window was the second choice. The first (2020-04 to 2020-08)
 * had a fine support line but `readStructure` called it a range, which would have
 * made the classify stage's answer wrong — the same trap that reshaped level 2.3.
 * This window reads as a genuine uptrend: swing highs (k=5) at bars 313, 327 and
 * 354, each above the last, and a support line through the lows of 308 (1.1867) and
 * 375 (1.2534) with 14 touches and zero body cuts.
 *
 * The predict stage is weighted lightest at 0.10 because it scores participation
 * rather than accuracy — at an equal share it would hand over a guaranteed quarter
 * and lower the bar for the three stages that are actually being tested.
 */
export const level: Level<"composite"> = {
  id: "2-B",
  chapter: 2,
  title: "Read a market you have not seen",
  kind: "composite",
  brief:
    "Everything so far has been Bitcoin. This is the euro in 2006. Same four questions, different market — that is the test.",
  data: [{ series: "EURUSD-1d", from: 300, to: 390, label: "EURUSD · daily" }],
  config: {
    steps: [
      {
        kind: "mark-bars",
        weight: 0.3,
        brief: "Mark the swing highs",
        config: { prompt: "Mark the three swing highs.", mode: "bars", expected: 3 },
        target: { marks: [barMark(313), barMark(327), barMark(354)] },
        tolerance: { barSlop: 2 },
        misconceptions: [
          {
            id: "boss-marked-lows",
            test: (attempt, level, data) => {
              const series = data[0];
              if (!series) return false;
              return attempt.marks.some((m) => {
                const i = Number(m.slice(4));
                const lows = [i - 2, i - 1, i, i + 1, i + 2].map(
                  (j) => series.l[j] ?? Infinity,
                );
                return (series.l[i] ?? Infinity) === Math.min(...lows);
              });
            },
            message:
              "At least one of those is a swing low. The structure question asks for the peaks, in this market exactly as in the last one.",
          },
          {
            id: "boss-too-few-highs",
            test: (attempt) => attempt.marks.length < 2,
            message:
              "There are three peaks that stand clear of their neighbours here. Finding one is a start, but the structure only reads once you have the sequence.",
          },
        ],
      },
      {
        kind: "annotate",
        weight: 0.35,
        brief: "Draw the trendline",
        config: {
          prompt: "Draw the rising support line under the lows.",
          shape: "trendline",
          side: "support",
          requiredTouches: 3,
          expectSlope: "up",
        },
        target: {
          reference: {
            shape: "trendline",
            a: { bar: 308, price: 1.1867 },
            b: { bar: 375, price: 1.2534 },
          },
        },
        tolerance: { priceFracOfRange: 0.02, barSlop: 1 },
        misconceptions: [
          {
            id: "boss-line-falls",
            test: (attempt) => {
              const d = attempt.drawing;
              if (!d || d.shape !== "trendline" || d.b.bar === d.a.bar) return false;
              return (d.b.price - d.a.price) / (d.b.bar - d.a.bar) <= 0;
            },
            message:
              "The line falls, but this market's lows are rising. The prices look nothing like Bitcoin's — a shade over one dollar rather than ten thousand — and the reading is exactly the same.",
          },
          {
            id: "boss-line-too-short",
            test: (attempt) => {
              const d = attempt.drawing;
              if (!d || d.shape !== "trendline") return false;
              return Math.abs(d.b.bar - d.a.bar) < 15;
            },
            message:
              "Too short a span. Any two lows make a line; a trendline has to hold across a stretch of chart before it tells you anything.",
          },
          {
            id: "boss-not-on-wicks",
            test: (attempt, level, data) => {
              const drawing = attempt.drawing;
              const series = data[0];
              const slice = level.data[0];
              if (!drawing || !series || !slice) return false;
              const tol = priceTolerance(
                series,
                { from: slice.from, to: slice.to },
                level.tolerance,
              );
              return anchorsOf(drawing).some(
                (anchor) => anchorQuality(anchor, series, tol) !== "wick",
              );
            },
            message:
              "Anchor both ends on the lows. The score counts anchor placement, so a line resting above the wicks loses marks even when its slope and touches are right.",
          },
        ],
      },
      {
        kind: "classify",
        weight: 0.25,
        brief: "Name the structure",
        config: {
          prompt: "What is this market doing?",
          options: [
            { id: "up", label: "Higher highs and higher lows — an uptrend." },
            { id: "down", label: "Lower highs and lower lows — a downtrend." },
            { id: "range", label: "Neither: the highs and lows overlap." },
          ],
        },
        target: { correct: ["up"] },
        tolerance: {},
        misconceptions: [
          {
            id: "boss-called-range",
            test: (attempt) => attempt.selected.includes("range"),
            message:
              "The peaks and troughs both step upwards here: each of the three highs you marked sits above the one before it, and so does each low. That is a sequence, not an overlap.",
          },
          {
            id: "boss-called-down",
            test: (attempt) => attempt.selected.includes("down"),
            message:
              "That is the opposite reading. Check the order of the swing highs you marked in the first stage — each one is above the last.",
          },
        ],
      },
      {
        kind: "predict-next",
        weight: 0.1,
        brief: "Call the next ten bars",
        config: { prompt: "Where does price go from here?", horizon: 10 },
        target: {},
        tolerance: {},
        data: [{ series: "EURUSD-1d", from: 300, to: 380 }],
        misconceptions: [
          {
            id: "boss-unfinished-call",
            test: (attempt) => attempt.calls.some((c) => c === null),
            message:
              "Make the call. This stage scores whether you committed, not whether you were right — reading structure does not make the next bar knowable.",
          },
          {
            id: "boss-trend-is-not-a-forecast",
            test: (attempt) => attempt.calls.length > 0,
            message:
              "Whatever happened next: an uptrend is a description of what price has already done, not a prediction of what it will do. Chapter 1's coin flip applies here too.",
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
      id: "boss-incomplete",
      test: (attempt) => attempt.steps.some((s) => s === null),
      message:
        "Some stages are still unanswered. The boss weighs all four together, so an unattempted stage counts as zero rather than being skipped.",
    },
    {
      id: "boss-different-market",
      test: () => true,
      message:
        "This was the euro, not Bitcoin. Nothing you used here was specific to crypto — swing highs, a support line and a structural reading work the same on any market that has a chart.",
    },
  ],
  hints: [],
};
