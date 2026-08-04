import { atr } from "@/lib/ta/atr";
import type { Series } from "./types";

/**
 * A chart's window described in words and numbers, for a reader who cannot see it.
 *
 * The chart is announced as `role="img"` with a label naming the series and the bar count, which is
 * where a screen-reader user's information ended before M11. This is the rest of it.
 *
 * ## Two rules the shape of this module enforces
 *
 * **A table of every visible bar is not a fallback.** A screen reader reads linearly, so 250 rows of
 * OHLC is closer to a denial of service than to a chart — the reader would have to hold two hundred
 * numbers in their head to learn what a sighted player gets in a glance. So the output is a summary
 * plus a sample, and `SAMPLE_ROWS` is small on purpose.
 *
 * **Nothing here may be derived from a level's `target`.** It would be the obvious next feature —
 * "mark the bars the level is about" — and it would hand a `mark-bars` player the answer as text while
 * a sighted player hunts for it. `Mark` is `bar:${number}`, so a target-derived table is literally the
 * answer key. This module takes a series and a range and has no access to a level at all, which is the
 * cheapest way to keep that true.
 *
 * The net change is reported in ATR as well as percent because that is the comparator Chapter 8 is
 * built on: 3% is an ordinary day for Bitcoin and a crisis for the index, and a reader who cannot see
 * the candles needs the unit that travels.
 */

/** Rows in the sample. Twenty is about what a listener can hold; two hundred is not. */
export const SAMPLE_ROWS = 20;

export type SummaryRow = {
  bar: number;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type ChartSummary = {
  seriesId: string;
  timeframe: string;
  bars: number;
  firstDate: string;
  lastDate: string;
  high: number;
  low: number;
  /** Close-to-close over the window, as a percentage. */
  changePct: number;
  /**
   * The same move in multiples of the window's typical daily range.
   *
   * Null when ATR cannot be computed — a window shorter than its own lookback. Reported rather than
   * defaulted to zero, because "no reading" and "no movement" are different facts.
   */
  changeAtr: number | null;
  /** Evenly spaced through the window, always including the first and last bar. */
  rows: SummaryRow[];
};

const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * Indices sampled evenly across `[from, to)`, first and last always included.
 *
 * Even spacing rather than "the most interesting bars", because choosing interesting ones would mean
 * deciding what matters — which is the level's question, not this module's.
 */
export function sampleIndices(from: number, to: number, rows = SAMPLE_ROWS): number[] {
  const count = to - from;
  if (count <= 0) return [];
  if (count <= rows) return Array.from({ length: count }, (_, i) => from + i);

  const last = to - 1;
  const step = (last - from) / (rows - 1);
  const picked = Array.from({ length: rows }, (_, i) => Math.round(from + i * step));
  // Rounding can collide at the ends on small windows; dedupe rather than emit a repeated row.
  return [...new Set(picked)];
}

export function summarise(
  series: Series<string>,
  range: { from: number; to: number },
  atrPeriod = 14,
): ChartSummary | null {
  const from = Math.max(0, range.from);
  const to = Math.min(series.c.length, range.to);
  if (to - from <= 0) return null;

  let high = -Infinity;
  let low = Infinity;
  for (let i = from; i < to; i += 1) {
    const h = series.h[i];
    const l = series.l[i];
    if (h !== undefined) high = Math.max(high, h);
    if (l !== undefined) low = Math.min(low, l);
  }

  const firstClose = series.c[from];
  const lastClose = series.c[to - 1];
  const changePct =
    firstClose && lastClose ? ((lastClose - firstClose) / firstClose) * 100 : 0;

  // ATR at the window's *last* bar: the reader is being told what an ordinary day looks like by the
  // end of the stretch they are hearing about, which is the bar a level's question sits on.
  const volatility = atr(series, to - 1, atrPeriod);
  const changeAtr =
    volatility > 0 && firstClose !== undefined && lastClose !== undefined
      ? (lastClose - firstClose) / volatility
      : null;

  const rows = sampleIndices(from, to).flatMap((bar) => {
    const t = series.t[bar];
    const open = series.o[bar];
    const barHigh = series.h[bar];
    const barLow = series.l[bar];
    const close = series.c[bar];
    if (
      t === undefined ||
      open === undefined ||
      barHigh === undefined ||
      barLow === undefined ||
      close === undefined
    ) {
      return [];
    }
    return [{ bar, date: isoDay(t), open, high: barHigh, low: barLow, close }];
  });

  return {
    seriesId: series.id,
    timeframe: series.tf,
    bars: to - from,
    firstDate: rows[0]?.date ?? "",
    lastDate: rows.at(-1)?.date ?? "",
    high: high === -Infinity ? 0 : high,
    low: low === Infinity ? 0 : low,
    changePct,
    changeAtr,
    rows,
  };
}

/** The summary as one sentence, which is what most readers will want and all they will hear first. */
export function summaryLine(summary: ChartSummary): string {
  const direction = summary.changePct >= 0 ? "up" : "down";
  const atrPart =
    summary.changeAtr === null
      ? ""
      : `, ${Math.abs(summary.changeAtr).toFixed(1)} times an ordinary day's range`;
  return (
    `${summary.seriesId}, ${summary.timeframe}, ${summary.bars} bars from ${summary.firstDate} to ${summary.lastDate}. ` +
    `High ${summary.high}, low ${summary.low}. ` +
    `Net ${direction} ${Math.abs(summary.changePct).toFixed(1)}%${atrPart}.`
  );
}
