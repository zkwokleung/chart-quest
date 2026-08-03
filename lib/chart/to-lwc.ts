import type {
  LineData,
  CandlestickData,
  HistogramData,
  UTCTimestamp,
} from "lightweight-charts";
import { barAt, seriesLength, type BarRange, type Series } from "./types";

/**
 * Converts columnar series data into the shape lightweight-charts wants.
 *
 * This is the only place the two representations meet — the rest of the app stays
 * columnar so bar indices remain the addressing scheme (see docs/DATA.md).
 */

/** Clamps an authored range to what the series actually contains. */
export function clampRange(series: Series<string>, range?: BarRange): BarRange {
  const length = seriesLength(series);
  if (!range) return { from: 0, to: length };
  const from = Math.max(0, Math.min(Math.trunc(range.from), length));
  const to = Math.max(from, Math.min(Math.trunc(range.to), length));
  return { from, to };
}

function toTimestamp(ms: number): UTCTimestamp {
  return Math.floor(ms / 1000) as UTCTimestamp;
}

/**
 * Closes only, for series in `RENDER_AS_LINE`.
 *
 * Uses the close rather than a midpoint or a typical price: the close is the one price in
 * these bars that is not in question, and every indicator in the codebase already reads it.
 */
export function toCloseLineData(
  series: Series<string>,
  range?: BarRange,
): LineData<UTCTimestamp>[] {
  const { from, to } = clampRange(series, range);
  const out: LineData<UTCTimestamp>[] = [];
  for (let i = from; i < to; i += 1) {
    const bar = barAt(series, i);
    if (!bar) continue;
    out.push({ time: toTimestamp(bar.t), value: bar.c });
  }
  return out;
}

export function toCandlestickData(
  series: Series<string>,
  range?: BarRange,
): CandlestickData<UTCTimestamp>[] {
  const { from, to } = clampRange(series, range);
  const out: CandlestickData<UTCTimestamp>[] = [];
  for (let i = from; i < to; i += 1) {
    const bar = barAt(series, i);
    if (!bar) continue;
    out.push({
      time: toTimestamp(bar.t),
      open: bar.o,
      high: bar.h,
      low: bar.l,
      close: bar.c,
    });
  }
  return out;
}

export function toVolumeData(
  series: Series<string>,
  range?: BarRange,
): HistogramData<UTCTimestamp>[] {
  const { from, to } = clampRange(series, range);
  const out: HistogramData<UTCTimestamp>[] = [];
  for (let i = from; i < to; i += 1) {
    const bar = barAt(series, i);
    if (!bar) continue;
    out.push({ time: toTimestamp(bar.t), value: bar.v });
  }
  return out;
}

/**
 * An indicator's values, timestamped against the bars they belong to.
 *
 * `values` is parallel to the whole series, so index i is bar i — the same
 * addressing everything else uses. Bars where the indicator is undefined are
 * omitted rather than plotted as zero, which would draw a line to the floor for
 * the first `period` bars of every chart.
 */
export function toLineData(
  series: Series<string>,
  values: readonly (number | null)[],
  range?: BarRange,
): { time: UTCTimestamp; value: number }[] {
  const { from, to } = clampRange(series, range);
  const out: { time: UTCTimestamp; value: number }[] = [];
  for (let i = from; i < to; i += 1) {
    const value = values[i];
    const bar = barAt(series, i);
    if (
      !bar ||
      value === null ||
      value === undefined ||
      !Number.isFinite(value)
    ) {
      continue;
    }
    out.push({ time: toTimestamp(bar.t), value });
  }
  return out;
}
