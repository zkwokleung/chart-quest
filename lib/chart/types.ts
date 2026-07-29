export type Timeframe = "1d" | "4h" | "1h" | "15m";

export type SeriesId = string;

/**
 * Columnar rather than an array of bar objects: JSON does not repeat the six key
 * names per bar, which is roughly a 4x size saving across the committed data set.
 * See docs/DATA.md.
 *
 * All six arrays are parallel and the same length. `t` is epoch milliseconds,
 * ascending, with no duplicates.
 */
export type Series = {
  id: SeriesId;
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

export function seriesLength(series: Series): number {
  return series.t.length;
}

/**
 * Reads one bar, or null when the index is out of range.
 *
 * Returns null rather than throwing because callers are usually hit-testing a
 * pointer position, where "off the end of the data" is an ordinary outcome
 * rather than a bug.
 */
export function barAt(series: Series, index: number): Bar | null {
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
