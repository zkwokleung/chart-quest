import type {
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
export function clampRange(series: Series, range?: BarRange): BarRange {
  const length = seriesLength(series);
  if (!range) return { from: 0, to: length };
  const from = Math.max(0, Math.min(Math.trunc(range.from), length));
  const to = Math.max(from, Math.min(Math.trunc(range.to), length));
  return { from, to };
}

function toTimestamp(ms: number): UTCTimestamp {
  return Math.floor(ms / 1000) as UTCTimestamp;
}

export function toCandlestickData(
  series: Series,
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
  series: Series,
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
