import type { Timeframe } from "../../lib/chart/types.ts";
import {
  buildSeries,
  type BuildResult,
  type Precision,
  type RawBar,
} from "../lib/columnar.ts";
import { getJson } from "../lib/http.ts";

type YahooChart = {
  chart: {
    error: { code: string; description: string } | null;
    result?: [
      {
        timestamp?: number[];
        indicators: {
          quote: [
            {
              open?: (number | null)[];
              high?: (number | null)[];
              low?: (number | null)[];
              close?: (number | null)[];
              volume?: (number | null)[];
            },
          ];
          adjclose?: [{ adjclose?: (number | null)[] }];
        };
        events?: {
          splits?: Record<string, { date: number; numerator: number; denominator: number }>;
        };
      },
    ];
  };
};

export type SplitEvent = { atMs: number; ratio: number };

export type YahooSeries = BuildResult & {
  /** Splits Yahoo has already applied to the prices above, oldest first. */
  splits: SplitEvent[];
};

/**
 * Yahoo's chart endpoint.
 *
 * `quote.close` is split-adjusted but not dividend-adjusted; `adjclose` is both.
 * We keep `quote` so OHLC stays internally consistent — mixing an adjusted close
 * with an unadjusted high produces bars where the close sits outside its own
 * range, which the validator would (correctly) reject.
 *
 * Intraday history is hard-capped upstream: 15m and 30m to roughly 60 days, 1h to
 * roughly 730. Beyond that the API returns an error rather than truncating, so
 * callers must pass a window the interval actually supports.
 */
export async function fetchYahoo(
  symbol: string,
  tf: Timeframe,
  startSec: number,
  endSec: number,
  { id, precision }: { id: string; precision: Precision },
): Promise<YahooSeries> {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?period1=${startSec}&period2=${endSec}&interval=${tf}&events=div%2Csplit`;

  const payload = await getJson<YahooChart>(url);
  if (payload.chart.error) {
    throw new Error(`${symbol} ${tf}: ${payload.chart.error.description}`);
  }
  const result = payload.chart.result?.[0];
  if (!result?.timestamp) throw new Error(`${symbol} ${tf}: no timestamps returned`);

  const q = result.indicators.quote[0];
  const bars: RawBar[] = result.timestamp.map((sec, i) => ({
    t: sec * 1000,
    o: q.open?.[i] ?? null,
    h: q.high?.[i] ?? null,
    l: q.low?.[i] ?? null,
    c: q.close?.[i] ?? null,
    v: q.volume?.[i] ?? null,
  }));

  const splits: SplitEvent[] = Object.values(result.events?.splits ?? {})
    .map((s) => ({ atMs: s.date * 1000, ratio: s.numerator / s.denominator }))
    .sort((a, b) => a.atMs - b.atMs);

  return { ...buildSeries(id, tf, bars, precision), splits };
}
