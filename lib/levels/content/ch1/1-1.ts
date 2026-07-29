import { partMark } from "../../mark";
import type { Level } from "../../schema";

/**
 * BTCUSDT-1d bar 207 (2018-03-12): open 9533.57, high 9888.88, low 8780,
 * close 9131.34. A down day with both wicks clearly visible and a body around
 * 40% of the range — enough of each part to point at.
 */
const FOCUS = 207;

export const level: Level<"mark-bars"> = {
  id: "1-1",
  chapter: 1,
  title: "Anatomy of a candle",
  kind: "mark-bars",
  brief:
    "One candle holds four prices. This one opened at 9533.57 and closed lower, at 9131.34 — so which part of it is the body?",
  data: [{ series: "BTCUSDT-1d", from: FOCUS, to: FOCUS + 1 }],
  config: {
    prompt: "Mark the body of this candle.",
    mode: "candle-anatomy",
    focusBar: FOCUS,
    expected: 1,
  },
  target: { marks: [partMark("body")] },
  tolerance: { barSlop: 0 },
  stars: [0.5, 0.9, 1],
  misconceptions: [
    {
      id: "picked-a-wick",
      test: (attempt) =>
        attempt.marks.some(
          (m) => m === partMark("upper-wick") || m === partMark("lower-wick"),
        ),
      message:
        "That is a wick. Wicks are the thin lines showing the extremes price reached and was pushed back from. The body is the thick part, spanning open to close.",
    },
    {
      id: "picked-an-edge",
      test: (attempt) =>
        attempt.marks.some((m) => m === partMark("open") || m === partMark("close")),
      message:
        "Open and close are the two edges of the body, not the body itself. The body is the block between them — here, from 9533.57 down to 9131.34.",
    },
    {
      id: "marked-everything",
      test: (attempt) => attempt.marks.length >= 3,
      message:
        "Marking every part cannot be right — the question asks for one. Each part of a candle means something different, and telling them apart is the whole skill.",
    },
  ],
  hints: [
    "The body is the thick part. The wicks are the thin lines poking out of it.",
    "Open and close are the edges of the body. The body is what sits between them.",
  ],
  unlocks: ["crosshair"],
};
