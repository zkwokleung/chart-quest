import type { Level } from "../../schema";

/**
 * Boss: BTCUSDT-4h 4759-4864, trigger bar 4819 (2023-03-15 04:00).
 *
 * A different market from every level in the chapter, which taught on SPY. The
 * player's first trade.
 *
 * **This is a pullback in an uptrend, not a retest of a horizontal level, and the
 * brief says so.** `docs/CURRICULUM.md` describes 3.B as "mark the zone, place
 * entry/stop/target" — but the level the first data search turned up (24877) was
 * touched exactly once before price broke it two bars later, so calling it tested
 * structure would have been inventing a story the chart does not tell. What the
 * window really holds is a 35% run from 19,549 to 26,387 in about sixty bars, a
 * pullback to 23,976, and a continuation to 28,868. The structure the stop has to
 * respect is that pullback low. Recorded in CURRICULUM.md as a deviation.
 *
 * Measured through `simulate`, which the content-claims test re-checks:
 *
 *  - entry is the close of bar 4819, 24,871.28; ATR(14) is 943.85, or 3.79% of price
 *  - a stop **on** the pullback low is taken out at +3 bars for −1R, because bar
 *    4822 trades to 23,896.95 — 79 points below it
 *  - a stop with about a tenth of an ATR of room below the low survives and reaches
 *    2R in 13 to 16 bars
 *  - a stop wider than about 2.4x ATR never reaches its own 2R target inside the
 *    window, because the target moves further away with the risk
 *
 * That last point is why the ATR band has an upper bound at all, and it is the
 * whole reason this window was chosen over BTC-4h bar 4240. There, a stop given
 * proper room *loses* while one crammed onto the swing low wins — the exact inverse
 * of the lesson. A boss window has to reward the behaviour being taught, and that
 * has to be simulated before the level is locked rather than assumed.
 */
export const level: Level<"replay-trade"> = {
  id: "3-B",
  chapter: 3,
  title: "Your first trade",
  kind: "replay-trade",
  brief:
    "Bitcoin, four-hour bars, March 2023. Price has run hard and just pulled back. Step the replay to where you would buy, put your stop somewhere you can defend, and pick a target worth the risk.",
  data: [{ series: "BTCUSDT-4h", from: 4759, to: 4864, label: "BTCUSDT · 4h" }],
  config: {
    prompt:
      "Place your stop and target, say why, then take the trade and play the replay out.",
    side: "long",
    // 61 bars visible: the run up and the pullback, ending on the trigger bar.
    primeBars: 61,
    maxBars: 45,
    minRR: 2,
    atrPeriod: 14,
  },
  target: {
    // The pullback low. A long's stop belongs below it, not on it.
    structure: { shape: "level", price: 23976.42 },
    triggerBar: 4819,
  },
  tolerance: {
    // Below 1.05x ATR of risk the stop sits at or above 23,896.95, which price
    // reaches three bars later. Above 2.2x the 2R target stops being reachable
    // inside the window. Both bounds are measured, not chosen for roundness.
    minAtr: 1.05,
    maxAtr: 2.2,
    barSlop: 2,
  },
  stars: [0.4, 0.7, 0.9],
  misconceptions: [
    {
      id: "boss-stop-on-the-low",
      test: (attempt, lvl) => {
        const structure = lvl.target.structure;
        if (structure.shape !== "level") return false;
        return attempt.stop >= structure.price;
      },
      message:
        "Your stop is at or above the pullback low — where every other stop in this market is sitting. Price traded 79 points through that low three bars later and then ran to 28,800 without you. A stop needs room to be wrong about the exact low and still right about the idea.",
    },
    {
      id: "boss-stop-too-wide",
      test: (attempt, lvl, data) => {
        const series = data[0];
        if (!series) return false;
        const entry = series.c[lvl.target.triggerBar];
        if (entry === undefined) return false;
        // Deliberately not using atr() here: a misconception test that shares the
        // grader's helper can only ever agree with it. This is a coarse check on
        // the same idea, so a disagreement between them is visible.
        return entry - attempt.stop > entry * 0.09;
      },
      message:
        "That stop is more than 9% away. Room is good; this is not room, it is hope. Your target moves out with your risk, so a stop this wide needs a move that never comes inside the window.",
    },
    {
      id: "boss-thin-reward",
      test: (attempt, lvl, data) => {
        const series = data[0];
        if (!series || attempt.target === null) return false;
        const entry = series.c[lvl.target.triggerBar];
        if (entry === undefined) return false;
        const risk = entry - attempt.stop;
        if (risk <= 0) return false;
        return (attempt.target - entry) / risk < 2;
      },
      message:
        "Less than two to one. At 1:1 you have to be right more than half the time just to break even, and Chapter 1's coin flip already showed what your hit rate is. The reward has to pay for the times you are wrong.",
    },
    {
      id: "boss-no-target",
      test: (attempt) => attempt.target === null,
      message:
        "No target means no reward:risk, which means no way to know whether the trade was worth taking before you took it. Deciding once you are in is how a small loss becomes a large one.",
    },
  ],
  hints: [
    "Look at where the pullback stopped, then ask what price would have to do to prove you wrong.",
    "The low of the pullback is 23,976. Your stop wants to be under it, not on it.",
  ],
};
