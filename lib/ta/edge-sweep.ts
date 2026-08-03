import type { Series, SeriesId } from "@/lib/chart/types";
import { breakoutN, runEdge } from "./edges";

/**
 * One rule, one knob, two windows — the measurement level 9.5 is built on.
 *
 * The player tunes a breakout's lookback until the first window looks brilliant, and then the
 * second window says what that was worth. Everything here exists to make that comparison honest.
 *
 * ## The split is inside the in-sample data, and the words matter
 *
 * `public/data/oos/` is Chapter 10's holdback, and no Chapter 1-9 level may touch it —
 * `OosSeriesId` makes it a compile error and a guard checks it at runtime too. So this splits a
 * series that Chapters 1-8 have already taught on, which means **9.5 must not say
 * "out-of-sample" unqualified.** Chapter 10.6 uses that phrase for bars the game has never
 * shown anybody, and a game with two meanings for its most load-bearing term has none. 9.5 says
 * "the later third".
 *
 * ## What the sweep found, and why the level shows four markets
 *
 *   GC-1d    best in-sample n=11: 35.9R in, 10.1R later, ranked **21st of 26**
 *   SPY-1d   best in-sample n=9:  26.2R in,  4.3R later, ranked **25th of 26**
 *   BTC-1d   best in-sample n=33: 16.0R in,  6.7R later, ranked 13th — the median exactly
 *   AAPL-1d  best in-sample n=5:  51.7R in, 29.3R later, ranked **3rd of 26**
 *
 * On gold and the index the lesson is stronger than "tuning does not help": the parameter the
 * player picked does *worse* later than almost every parameter they did not pick. The index is
 * the sharpest case — twenty-fifth of twenty-six, so twenty-four untuned alternatives beat the
 * tuned one.
 *
 * And Apple is why one market would misrepresent it: its optimum held up, third of twenty-six.
 * Overfitting is not reliably punished, which is exactly why Chapter 10 demands three markets
 * rather than trusting one. A level built on gold alone would replace a false rule with another
 * false rule.
 *
 * ## And the result that turned out to be the level
 *
 * Order the four markets by how much tuning *appeared* to help, and you get exactly their order
 * by how badly it let them down:
 *
 *   SPY   the tuned parameter made 1.94x an average one in-sample  ->  25th of 26 later
 *   GC    1.64x                                                    ->  21st
 *   BTC   1.38x                                                    ->  13th
 *   AAPL  1.19x                                                    ->   3rd
 *
 * Monotone, on four markets. So the lesson is **not** "the optimum collapses", which Apple
 * disproves — it is that *how excited the in-sample result made you predicts how much it will
 * cost you*. That is a claim about the tuner rather than about the market, which is why it
 * survives its own counter-example, and it is a better level than the one specified.
 *
 * Apple is the case worth sitting with: its in-sample curve is nearly flat, so there was no peak
 * to overfit *to*, and its optimum duly held up. Nothing was tuned, so nothing broke.
 *
 * ## The rank is the statistic, not the drop
 *
 * A total falling from 38.6R to 10.1R can be explained away: the later window is shorter. The
 * *rank* cannot — it compares the chosen parameter against twenty-five alternatives measured
 * over the identical bars. That is why it is computed here rather than left to a reader.
 */

/** Fraction of each series used for tuning. The rest is the later window. */
export const IN_SAMPLE_FRACTION = 0.7;

/** Lookbacks swept. Twenty-six values, odd so no two share a midpoint. */
export const LOOKBACKS: readonly number[] = Array.from(
  { length: 26 },
  (_, i) => 5 + i * 2,
);

/** The four markets 9.5 shows. Chosen so the counter-example is among them. */
export const SWEPT: readonly SeriesId[] = [
  "GC-1d",
  "SPY-1d",
  "AAPL-1d",
  "BTCUSDT-1d",
];

export const DEFINITION =
  "One rule — close above the highest high of the previous n bars, a stop 2 ATR below entry " +
  "and a target 2R above, entering only when flat. The first 70% of each market's history is " +
  "for tuning; the rest is held back and measured once. `rankLater` is where a lookback's " +
  "later-window total placed among all 26 swept, best first — so rank 1 is the best of the " +
  "twenty-six and rank 26 the worst. It is the honest statistic here, because a total can be " +
  "explained away by a shorter window and a rank cannot.";

export type SweepCell = {
  n: number;
  inSample: { trades: number; totalR: number; perTradeR: number; maxDrawdownR: number };
  later: { trades: number; totalR: number; perTradeR: number; maxDrawdownR: number };
  /** Where this lookback's later total placed among all swept, 1 = best. */
  rankLater: number;
};

export type SweepForAsset = {
  asset: SeriesId;
  /** Bar the later window starts at, and the date, so a reader can check the split. */
  splitBar: number;
  splitDate: string;
  cells: SweepCell[];
  /** The lookback with the best in-sample total — what a tuner would pick. */
  bestInSample: number;
  /** That lookback's later-window rank. The number the level turns on. */
  bestInSampleRankLater: number;
};

/**
 * Peak-to-trough of a cumulative R curve, in R.
 *
 * The same definition `lib/journal/analytics.ts` uses, and for the same reason: there is no
 * account here, so a drawdown expressed as a percentage would be a percentage of nothing.
 */
function drawdownR(rs: readonly number[]): number {
  let running = 0;
  let peak = 0;
  let deepest = 0;
  for (const r of rs) {
    running += r;
    peak = Math.max(peak, running);
    deepest = Math.min(deepest, running - peak);
  }
  return Math.abs(deepest);
}

/** One lookback on one window, with the drawdown the totals cannot give. */
function measure(
  series: Series<string>,
  n: number,
  window: { from: number; to: number },
) {
  const result = runEdge(series, breakoutN(n), window);
  return {
    trades: result.trades,
    totalR: result.totalR,
    perTradeR: result.perTradeR,
    maxDrawdownR: drawdownR(result.rs),
  };
}

export function sweepAsset(
  asset: SeriesId,
  series: Series<string>,
): SweepForAsset {
  const splitBar = Math.floor(series.c.length * IN_SAMPLE_FRACTION);
  const inWindow = { from: 0, to: splitBar };
  const laterWindow = { from: splitBar, to: series.c.length };

  const partial = LOOKBACKS.map((n) => ({
    n,
    inSample: measure(series, n, inWindow),
    later: measure(series, n, laterWindow),
  }));

  // Rank by later-window total, best first. Ties share the better rank, which is the reading a
  // player would give them.
  const ordered = [...partial].sort((a, b) => b.later.totalR - a.later.totalR);
  const rankOf = new Map<number, number>();
  ordered.forEach((cell, i) => rankOf.set(cell.n, i + 1));

  const cells: SweepCell[] = partial.map((cell) => ({
    ...cell,
    rankLater: rankOf.get(cell.n)!,
  }));

  const best = [...cells].sort(
    (a, b) => b.inSample.totalR - a.inSample.totalR,
  )[0]!;

  return {
    asset,
    splitBar,
    splitDate: new Date(series.t[splitBar]!).toISOString().slice(0, 10),
    cells,
    bestInSample: best.n,
    bestInSampleRankLater: best.rankLater,
  };
}

export type EdgeSweepFile = {
  definition: string;
  lookbacks: number[];
  inSampleFraction: number;
  assets: SweepForAsset[];
};

export function computeEdgeSweep(
  load: (id: SeriesId) => Series<string>,
): EdgeSweepFile {
  return {
    definition: DEFINITION,
    lookbacks: [...LOOKBACKS],
    inSampleFraction: IN_SAMPLE_FRACTION,
    assets: SWEPT.map((asset) => sweepAsset(asset, load(asset))),
  };
}
