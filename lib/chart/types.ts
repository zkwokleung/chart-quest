export type Timeframe = "1d" | "4h" | "1h" | "15m";

/**
 * Every series a level may reference.
 *
 * A literal union rather than `string`: levels address data by id, and across
 * ~73 levels a typo should be a compile error rather than a runtime 404. Keep in
 * step with `public/data/series/manifest.json` — a test asserts the two match.
 */
export type SeriesId =
  | "BTCUSDT-1d"
  | "BTCUSDT-4h"
  | "SPY-1d"
  | "SPY-15m"
  | "AAPL-1d"
  | "AAPL-1d-raw"
  | "EURUSD-1d"
  | "EURUSD-1h"
  | "GC-1d"
  | "LAKE-1d"
  /** Synthetic, for the chart harness and unit tests. Never referenced by a level. */
  | "FIXTURE-1d";

/**
 * Series with an out-of-sample counterpart held back for Chapter 10.
 *
 * Includes the 4h and 1h series, not only the dailies: Chapter 10 lets the player
 * choose their timeframe, and leaving one unsplit would let them skip
 * out-of-sample validation simply by picking it. Only SPY-15m is exempt — a
 * 60-day snapshot cannot spare a meaningful holdback, and it exists for the
 * session levels rather than for strategy building.
 */
export type HeldBackSeriesId =
  | "BTCUSDT-1d"
  | "BTCUSDT-4h"
  | "SPY-1d"
  | "AAPL-1d"
  | "EURUSD-1d"
  | "EURUSD-1h"
  | "GC-1d"
  | "LAKE-1d";

/**
 * Out-of-sample ids are a separate type on purpose: a level's `series` field
 * accepts only `SeriesId`, so no level can name one even by accident. This is the
 * compile-time half of the holdback guarantee — see docs/DATA.md.
 */
export type OosSeriesId = `${HeldBackSeriesId}-oos`;

/**
 * Columnar rather than an array of bar objects: JSON does not repeat the six key
 * names per bar, which is roughly a 4x size saving across the committed data set.
 * See docs/DATA.md.
 *
 * All six arrays are parallel and the same length. `t` is epoch milliseconds,
 * ascending, with no duplicates.
 */
export type Series<Id extends string = SeriesId> = {
  id: Id;
  tf: Timeframe;
  t: number[];
  o: number[];
  h: number[];
  l: number[];
  c: number[];
  v: number[];
};

export type Bar = {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
};

/** Half-open bar-index range, as authored in level data: `[from, to)`. */
export type BarRange = {
  from: number;
  to: number;
};

export function seriesLength(series: Series<string>): number {
  return series.t.length;
}

/**
 * Reads one bar, or null when the index is out of range.
 *
 * Returns null rather than throwing because callers are usually hit-testing a
 * pointer position, where "off the end of the data" is an ordinary outcome
 * rather than a bug.
 */
export function barAt(series: Series<string>, index: number): Bar | null {
  if (!Number.isInteger(index) || index < 0 || index >= series.t.length) {
    return null;
  }
  const t = series.t[index];
  const o = series.o[index];
  const h = series.h[index];
  const l = series.l[index];
  const c = series.c[index];
  const v = series.v[index];
  if (
    t === undefined ||
    o === undefined ||
    h === undefined ||
    l === undefined ||
    c === undefined ||
    v === undefined
  ) {
    return null;
  }
  return { t, o, h, l, c, v };
}
