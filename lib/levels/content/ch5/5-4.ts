import { barMark } from "../../mark";
import type { Level } from "../../schema";

/**
 * EURUSD-1d 4060-4150 (2020-09 to 2021-02), with MACD 12/26/9.
 *
 * Measured: six MACD crossings in this window, and **four of them went nowhere** —
 * price ten bars later had not moved 0.3% in the direction the cross pointed. The
 * targets are those four; bars 4084 and 4092 are the two that led somewhere and are
 * there as distractors.
 *
 * The level's real claim is in its title. MACD is the gap between a twelve-period
 * and a twenty-six-period EMA, and its signal line is an average of that gap — so a
 * "MACD cross" is the faster average overtaking the slower one and nothing more. It
 * is presented everywhere as an oracle, and two thirds of its crossings here are the
 * two averages brushing past each other in a market going sideways.
 */
export const level: Level<"mark-bars"> = {
  id: "5-4",
  chapter: 5,
  title: "MACD is two averages",
  kind: "mark-bars",
  brief:
    "Six crossings here. Four of them were followed by nothing at all. Click those four.",
  data: [
    { series: "EURUSD-1d", from: 4060, to: 4150, label: "EURUSD · daily" },
  ],
  config: {
    prompt: "Click the crossings that led nowhere.",
    mode: "bars",
    expected: 4,
  },
  target: {
    marks: [barMark(4093), barMark(4101), barMark(4107), barMark(4140)],
  },
  tolerance: { barSlop: 1 },
  stars: [0.45, 0.7, 0.9],
  misconceptions: [
    {
      id: "macd-marked-the-ones-that-worked",
      test: (attempt) =>
        attempt.marks.some((mark) => {
          const bar = Number(mark.replace("bar:", ""));
          return bar >= 4083 && bar <= 4085;
        }),
      message:
        "That one led somewhere — it is one of the two that did. The question is which crossings the market ignored, and the honest way to tell is what price did afterwards rather than how the crossing looked.",
    },
    {
      id: "macd-marked-a-non-cross",
      test: (attempt, lvl, data) => {
        const series = data[0];
        if (!series) return false;
        // A bar where the histogram did not change sign is not a crossing at all.
        return attempt.marks.some((mark) => {
          const bar = Number(mark.replace("bar:", ""));
          const known = [4084, 4092, 4093, 4101, 4107, 4140];
          return !known.some((k) => Math.abs(k - bar) <= 1);
        });
      },
      message:
        "Nothing crossed there. Look at the lower pane and find where the two lines actually swap over — the histogram passing through zero is the same event, drawn more clearly.",
    },
  ],
  hints: [
    "Find every crossing first, then ask what price did in the ten days after each.",
    "The two that worked are the earliest one and the one right after it.",
  ],
};
