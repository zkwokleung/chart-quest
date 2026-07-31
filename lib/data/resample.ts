import type { Series, Timeframe } from "@/lib/chart/types";

/**
 * Aggregating a series into a coarser timeframe.
 *
 * **Why this exists.** Chapter 6 teaches multi-timeframe reading, which needs two views
 * of the *same period*. Only Bitcoin has that in the committed data: its daily and 4h
 * series overlap across 2021–2023, while EURUSD's hourly starts in 2025 against a daily
 * that stops in 2023, and SPY's 15m covers two months of 2026 against a daily that stops
 * in 2023. Two views of a period neither series covers cannot be authored.
 *
 * Refetching was the alternative and would have meant refetching the dailies too, moving
 * every bar index in the twelve levels that address `SPY-1d`. Aggregating upward instead
 * invents nothing and shifts nothing.
 *
 * **This is exact, and provably so.** Grouping `BTCUSDT-4h` into UTC days reproduces the
 * committed `BTCUSDT-1d` on all 931 whole days it covers — open, high, low and close,
 * to within 1e-6 relative. `resample.test.ts` runs that identity as its headline case, so
 * the arithmetic here is checked against data already in the repo rather than against a
 * fixture someone wrote to match it.
 */

export type Bucket = Extract<Timeframe, "1h" | "4h" | "1d">;

const HOUR = 3_600_000;

/**
 * Bucket boundaries, in UTC, and each one is a choice.
 *
 * - `1d` — the UTC calendar day. This is what Binance's daily bar *is*, which is why the
 *   BTC identity lands exactly rather than approximately.
 * - `1h` — the UTC clock hour.
 * - `4h` — four-hour blocks measured from UTC midnight, so 00:00, 04:00, 08:00 and so on.
 *   Also Binance's convention.
 *
 * Sessions are deliberately *not* consulted. A US equity session opens at 09:30, so an
 * hour measured from the clock puts the first 30 minutes of the day in a bucket of its
 * own — which is then incomplete and dropped, see `resample`. Aligning to the session
 * instead would give a full first bar and a different set of boundaries per instrument,
 * which is a per-instrument rule this codebase has nowhere to put and no level asks for.
 */
function bucketStart(ms: number, bucket: Bucket): number {
  if (bucket === "1d") {
    const d = new Date(ms);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }
  const size = bucket === "4h" ? 4 * HOUR : HOUR;
  return Math.floor(ms / size) * size;
}

/** Source bars a whole bucket must contain, given the source timeframe. */
const BARS_PER_BUCKET: Record<Timeframe, Record<Bucket, number | null>> = {
  "15m": { "1h": 4, "4h": 16, "1d": 96 },
  "1h": { "1h": null, "4h": 4, "1d": 24 },
  "4h": { "1h": null, "4h": null, "1d": 6 },
  "1d": { "1h": null, "4h": null, "1d": null },
};

/**
 * How many source bars make one whole bucket, or null when the pairing is invalid.
 *
 * Invalid means the target is not strictly coarser than the source — resampling a daily
 * series into hours is not a thing, and neither is a no-op into the same timeframe.
 * Returning null rather than throwing lets the caller decide; `resample` throws.
 */
export function barsPerBucket(from: Timeframe, into: Bucket): number | null {
  return BARS_PER_BUCKET[from][into];
}

/**
 * A coarser series, built only from whole buckets.
 *
 * **Partial buckets are dropped rather than emitted short**, at both ends and anywhere
 * in the middle. A day missing four of its six 4h bars still has a high and a low, and
 * they are the high and low of two thirds of a day — a number that reads as a daily range
 * and is not one. There is no honest way to mark that in a columnar series, so the bar
 * does not exist.
 *
 * On a US equity session that drops the 09:30–10:00 stub from every trading day, which is
 * the price of clock-aligned hours and is stated here so it is not discovered later.
 */
export function resample<Id extends string>(
  series: Series<Id>,
  into: Bucket,
  id: string = `${series.id.replace(/-(1d|4h|1h|15m)$/, "")}-${into}`,
): Series<string> {
  const expected = barsPerBucket(series.tf, into);
  if (expected === null) {
    throw new Error(
      `cannot resample ${series.tf} into ${into}: the target must be strictly coarser`,
    );
  }

  const out: Series<string> = {
    id,
    tf: into,
    t: [],
    o: [],
    h: [],
    l: [],
    c: [],
    v: [],
  };

  let start = -1;
  let count = 0;
  let open = 0;
  let high = -Infinity;
  let low = Infinity;
  let close = 0;
  let volume = 0;

  const flush = () => {
    if (count === expected) {
      out.t.push(start);
      out.o.push(open);
      out.h.push(high);
      out.l.push(low);
      out.c.push(close);
      out.v.push(volume);
    }
  };

  for (let i = 0; i < series.t.length; i += 1) {
    const t = series.t[i];
    const o = series.o[i];
    const h = series.h[i];
    const l = series.l[i];
    const c = series.c[i];
    const v = series.v[i];
    if (
      t === undefined ||
      o === undefined ||
      h === undefined ||
      l === undefined ||
      c === undefined ||
      v === undefined
    ) {
      continue;
    }

    const bucket = bucketStart(t, into);
    if (bucket !== start) {
      flush();
      start = bucket;
      count = 0;
      open = o;
      high = -Infinity;
      low = Infinity;
      volume = 0;
    }

    count += 1;
    high = Math.max(high, h);
    low = Math.min(low, l);
    close = c;
    volume += v;
  }
  flush();

  return out;
}
