import type { HeldBackSeriesId, OosSeriesId, Series } from "../../lib/chart/types.ts";
import { sliceSeries, withId } from "./columnar.ts";

/**
 * Fraction of each series held back for Chapter 10's out-of-sample validation.
 *
 * Sized by what 10.6 actually needs rather than by a round number: a daily
 * strategy trades roughly monthly, so clearing the "at least 30 trades" bar wants
 * about three years. 15% of a 2005-2026 daily series is ~815 bars, a little over
 * three years, and leaves 2005 through ~2023 for teaching.
 */
export const OOS_FRACTION = 0.15;

/**
 * Everything except SPY-15m, which is a 60-day snapshot with no room to spare.
 * See the note on `HeldBackSeriesId`.
 */
export const HELD_BACK: readonly HeldBackSeriesId[] = [
  "BTCUSDT-1d",
  "BTCUSDT-4h",
  "SPY-1d",
  "AAPL-1d",
  "EURUSD-1d",
  "EURUSD-1h",
  "GC-1d",
  "LAKE-1d",
];

export function oosIdFor(id: HeldBackSeriesId): OosSeriesId {
  return `${id}-oos`;
}

export type SplitResult = {
  /** What chapters 1-9 teach on. */
  inSample: Series<HeldBackSeriesId>;
  /** Revealed only in Chapter 10. */
  outOfSample: Series<OosSeriesId>;
};

/**
 * Cuts the most recent `OOS_FRACTION` of a series away from the teaching set.
 *
 * The split is on bar index, not date, so it lands in the same place for every
 * series regardless of trading calendar. The two halves do not overlap: if a
 * player had already practised on these bars, Chapter 10's validation would prove
 * nothing.
 */
export function splitOos(series: Series<HeldBackSeriesId>): SplitResult {
  const n = series.t.length;
  const oosBars = Math.floor(n * OOS_FRACTION);
  if (oosBars < 200) {
    throw new Error(
      `${series.id}: a ${oosBars}-bar holdback is too short to validate against`,
    );
  }
  const cut = n - oosBars;

  return {
    inSample: sliceSeries(series, 0, cut),
    outOfSample: withId(sliceSeries(series, cut, n), oosIdFor(series.id)),
  };
}
