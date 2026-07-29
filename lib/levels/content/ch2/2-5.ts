import { barMark } from "../../mark";
import type { Level } from "../../schema";

/**
 * BTCUSDT-1d 120-200 (2017-12-15 to 2018-03-04).
 *
 * Two candidate breaks, and the dramatic one is the fake:
 *
 *   bar 152 (2018-01-16) closes 10,900, below the swing low of 11,400 at bar 147
 *          — a 13,540 to 10,900 collapse — then recovers to 12,800 by bar 156.
 *   bar 168 (2018-02-01) closes 9,225, below the swing low of 9,900 at bar 158,
 *          and every close after it stays lower.
 *
 * The quieter bar is the real break. That is the whole level.
 */
export const level: Level<"mark-bars"> = {
  id: "2-5",
  chapter: 2,
  title: "Break or deviation",
  kind: "mark-bars",
  brief:
    "Price dipped below a prior low twice here. Only one of those dips actually broke the structure.",
  data: [{ series: "BTCUSDT-1d", from: 120, to: 200, label: "BTCUSDT · daily" }],
  config: {
    prompt:
      "Mark the bar that broke structure — closed beyond a prior swing low and stayed beyond it.",
    mode: "bars",
    expected: 1,
  },
  target: { marks: [barMark(168)] },
  tolerance: { barSlop: 1 },
  stars: [0.5, 0.9, 1],
  misconceptions: [
    {
      id: "picked-the-january-deviation",
      test: (attempt) =>
        attempt.marks.some((m) => {
          const i = Number(m.slice(4));
          return i >= 150 && i <= 156;
        }),
      message:
        "That is the dramatic one, and it is the fake. Price closed below the prior low on 16 January and was back above it within four days, trading up to 12,800. A level only breaks if price stays broken.",
    },
    {
      id: "picked-the-lowest-bar",
      test: (attempt) =>
        attempt.marks.some((m) => Number(m.slice(4)) >= 172),
      message:
        "That is well after the break, when the decline was already underway. The break is the first close that went beyond a prior low and held — not the lowest bar that followed.",
    },
    {
      id: "marked-several",
      test: (attempt) => attempt.marks.length > 2,
      message:
        "Only one bar broke structure here. The others dipped and recovered, which is a deviation — the market probing a level rather than passing through it.",
    },
  ],
  hints: [
    "Find the swing lows first, then ask which dip below one was never reclaimed.",
    "Compare mid-January with the start of February: one recovered, one did not.",
  ],
};
