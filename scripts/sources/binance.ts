import type { Timeframe } from "../../lib/chart/types.ts";
import { buildSeries, type BuildResult, type RawBar } from "../lib/columnar.ts";
import { getJson } from "../lib/http.ts";

/** [openTime, open, high, low, close, volume, ...] — the rest is unused. */
type Kline = [number, string, string, string, string, string, ...unknown[]];

const PAGE = 1000;

/**
 * Binance public klines. No API key.
 *
 * BTCUSDT starts 2017-08-17 on every interval — the exchange's own launch — so
 * requesting earlier just returns the first available bar.
 */
export async function fetchBinance(
  symbol: string,
  tf: Timeframe,
  startMs: number,
  endMs: number,
): Promise<BuildResult> {
  const bars: RawBar[] = [];
  let cursor = startMs;

  for (;;) {
    const url =
      `https://api.binance.com/api/v3/klines?symbol=${symbol}` +
      `&interval=${tf}&startTime=${cursor}&endTime=${endMs}&limit=${PAGE}`;
    const page = await getJson<Kline[]>(url);
    if (page.length === 0) break;

    for (const k of page) {
      bars.push({
        t: k[0],
        o: Number(k[1]),
        h: Number(k[2]),
        l: Number(k[3]),
        c: Number(k[4]),
        v: Number(k[5]),
      });
    }

    if (page.length < PAGE) break;
    const last = page[page.length - 1];
    if (!last) break;
    cursor = last[0] + 1;
    if (cursor > endMs) break;
  }

  return buildSeries(`${symbol}-${tf}`, tf, bars, 2);
}
