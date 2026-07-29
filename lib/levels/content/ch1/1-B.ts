import type { Level } from "../../schema";

/**
 * Five rounds across three markets. Each chart stops; the player calls the next
 * five bars up or down; the bars appear.
 *
 * Deliberately ungradeable on accuracy. The whole point is that a beginner scores
 * near 50%, so the stars come from finishing all five rounds — see the grader.
 * Marking accuracy would either lock the game behind a coin flip or teach that a
 * lucky run is skill.
 *
 * The slices avoid every window used by 1.1-1.7, so no round can be recognised
 * from an earlier level. The true direction lives in the data, never in this file.
 */
export const level: Level<"predict-next"> = {
  id: "1-B",
  chapter: 1,
  title: "Coin flip",
  kind: "predict-next",
  brief:
    "Five charts, three markets. Call where each one goes next. Your score comes from finishing, not from being right — read the result carefully.",
  data: [
    { series: "BTCUSDT-1d", from: 1400, to: 1460, label: "Round 1 · BTCUSDT daily" },
    { series: "SPY-1d", from: 2200, to: 2260, label: "Round 2 · SPY daily" },
    { series: "EURUSD-1d", from: 3000, to: 3060, label: "Round 3 · EURUSD daily" },
    { series: "BTCUSDT-1d", from: 1800, to: 1860, label: "Round 4 · BTCUSDT daily" },
    { series: "SPY-1d", from: 3000, to: 3060, label: "Round 5 · SPY daily" },
  ],
  config: {
    prompt: "Where does price go over the next five bars?",
    horizon: 5,
  },
  target: {},
  tolerance: {},
  // Thresholds on participation: three of five rounds earns a star, all five earn
  // three. A player cannot fail this by being wrong, only by not finishing.
  stars: [0.6, 0.8, 1],
  misconceptions: [
    {
      id: "unfinished",
      test: (attempt) => attempt.calls.some((c) => c === null),
      message:
        "Some rounds are still uncalled. Every round has to be answered — the score here measures whether you took a position, not whether it paid off.",
    },
    {
      id: "near-chance",
      test: (attempt, level, data) => {
        // Recomputing the outcome here rather than reading the grade keeps the
        // misconception self-contained and pure.
        let right = 0;
        let graded = 0;
        level.data.forEach((slice, i) => {
          const series = data[i];
          const from = series?.c[slice.to - 1];
          const to = series?.c[slice.to - 1 + level.config.horizon];
          if (from === undefined || to === undefined) return;
          graded += 1;
          if (attempt.calls[i] === (to >= from ? "up" : "down")) right += 1;
        });
        return graded > 0 && right / graded <= 0.6;
      },
      message:
        "Around half right, which is what a coin does. That is the point of this level: nothing you have learned so far predicts the next bar, and any method that appears to must be measured against exactly this baseline.",
    },
    {
      id: "hot-streak",
      test: (attempt, level, data) => {
        let right = 0;
        let graded = 0;
        level.data.forEach((slice, i) => {
          const series = data[i];
          const from = series?.c[slice.to - 1];
          const to = series?.c[slice.to - 1 + level.config.horizon];
          if (from === undefined || to === undefined) return;
          graded += 1;
          if (attempt.calls[i] === (to >= from ? "up" : "down")) right += 1;
        });
        return graded > 0 && right / graded > 0.6;
      },
      message:
        "Better than chance — over five calls, which is what five coin flips do about a fifth of the time. Keep the number. Chapter 9 asks you to compare it against your real results, and the honest answer is usually that both are noise.",
    },
  ],
  hints: [],
};
