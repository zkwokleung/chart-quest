// Relative imports throughout scripts/: Node's type stripping runs these files
// directly but does not resolve the "@/*" tsconfig alias.
import type { Series, Timeframe } from "../../lib/chart/types.ts";

export type RawBar = {
  t: number;
  o: number | null;
  h: number | null;
  l: number | null;
  c: number | null;
  v: number | null;
};

/** Decimal places to keep. Full float precision on 5,000 bars is wasted bytes. */
export type Precision = 2 | 5;

export type BuildResult = {
  series: Series;
  /** Bars dropped for null/duplicate/non-finite values. */
  dropped: number;
  /** Bars whose high or low was widened to contain their own open and close. */
  repaired: number;
};

export function buildSeries(
  id: string,
  tf: Timeframe,
  bars: RawBar[],
  precision: Precision,
): BuildResult {
  const { clean, dropped, repaired } = normalize(bars, precision);

  return {
    series: {
      id,
      tf,
      t: clean.map((b) => b.t),
      o: clean.map((b) => b.o),
      h: clean.map((b) => b.h),
      l: clean.map((b) => b.l),
      c: clean.map((b) => b.c),
      v: clean.map((b) => b.v),
    },
    dropped,
    repaired,
  };
}

type CleanBar = { t: number; o: number; h: number; l: number; c: number; v: number };

/**
 * Drops unusable bars, enforces a strictly increasing timeline, and makes each
 * bar internally consistent.
 *
 * Two upstream problems are handled here rather than anywhere downstream:
 *
 * **Nulls and duplicate timestamps.** Yahoo emits nulls for halted or unopened
 * sessions and occasionally repeats a timestamp at a session boundary. Both would
 * become silent holes in a series that levels address by bar index.
 *
 * **Bars whose range excludes their own endpoints.** Roughly 5% of Yahoo's gold
 * bars and 2% of its EURUSD bars have a low above `min(open, close)` or a high
 * below `max(open, close)`, because the extremes and the endpoints come from
 * different feeds. Rendering one of those produces a candle whose wick does not
 * contain its body — which would be actively wrong in Chapter 1, whose subject is
 * candle anatomy. Widening the extreme to contain the endpoint is the minimal
 * correction: a bar's range must contain its own open and close by definition, and
 * this invents no price that was not already in the bar.
 */
function normalize(
  bars: RawBar[],
  precision: Precision,
): { clean: CleanBar[]; dropped: number; repaired: number } {
  const factor = 10 ** precision;
  const round = (x: number) => Math.round(x * factor) / factor;

  const clean: CleanBar[] = [];
  let dropped = 0;
  let repaired = 0;
  let lastT = -Infinity;

  for (const bar of bars) {
    if (
      bar.o === null ||
      bar.h === null ||
      bar.l === null ||
      bar.c === null ||
      !Number.isFinite(bar.t) ||
      !Number.isFinite(bar.o) ||
      !Number.isFinite(bar.h) ||
      !Number.isFinite(bar.l) ||
      !Number.isFinite(bar.c)
    ) {
      dropped += 1;
      continue;
    }
    if (bar.t <= lastT) {
      dropped += 1;
      continue;
    }
    lastT = bar.t;

    const o = round(bar.o);
    const c = round(bar.c);
    // Round the extremes outward so rounding itself can never produce a bar whose
    // range excludes its endpoints.
    const h = Math.max(round(bar.h), o, c);
    const l = Math.min(round(bar.l), o, c);
    if (h !== round(bar.h) || l !== round(bar.l)) repaired += 1;

    clean.push({
      t: bar.t,
      o,
      h,
      l,
      c,
      v: bar.v === null || !Number.isFinite(bar.v) ? 0 : Math.round(bar.v),
    });
  }

  return { clean, dropped, repaired };
}

export type ValidationOptions = {
  /** Refuse to write a series that is suspiciously short. */
  minBars: number;
  precision: Precision;
};

/**
 * Fails loudly rather than committing bad data. Once a series is committed,
 * levels address it by bar index and it becomes immutable — so this is the last
 * point at which a problem is cheap to fix.
 */
export function validateSeries(
  series: Series,
  { minBars, precision }: ValidationOptions,
): void {
  const n = series.t.length;
  const fail = (msg: string): never => {
    throw new Error(`${series.id}: ${msg}`);
  };

  if (n < minBars) fail(`only ${n} bars, expected at least ${minBars}`);

  for (const key of ["o", "h", "l", "c", "v"] as const) {
    if (series[key].length !== n) {
      fail(`column ${key} has ${series[key].length} entries, expected ${n}`);
    }
  }

  const tick = 10 ** -precision;
  let nonZeroRange = 0;

  for (let i = 0; i < n; i += 1) {
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
      fail(`bar ${i} has a missing column`);
      return;
    }

    if (!Number.isFinite(o + h + l + c + v)) fail(`bar ${i} has a non-finite value`);
    if (o <= 0 || h <= 0 || l <= 0 || c <= 0) fail(`bar ${i} has a non-positive price`);
    if (h < Math.max(o, c)) fail(`bar ${i} high ${h} is below max(open, close)`);
    if (l > Math.min(o, c)) fail(`bar ${i} low ${l} is above min(open, close)`);
    if (v < 0) fail(`bar ${i} has negative volume`);
    if (i > 0) {
      const prev = series.t[i - 1];
      if (prev !== undefined && t <= prev) fail(`bar ${i} timestamp is not increasing`);
    }
    if (h - l > tick / 2) nonZeroRange += 1;
  }

  // Guards the FX rounding risk: at 5dp EURUSD moves ~0.0001 per bar, so if
  // rounding had flattened the series most bars would have collapsed to h === l.
  const ratio = nonZeroRange / n;
  if (ratio < 0.5) {
    fail(
      `only ${(ratio * 100).toFixed(1)}% of bars have a high above their low — ` +
        `precision ${precision} is too coarse for this instrument`,
    );
  }
}

/**
 * Drops trailing bars newer than `ms`.
 *
 * Yahoo appends the current in-progress bar regardless of `period2`, which would
 * commit a partial candle — wrong to teach from, and it would silently fill in on
 * any later refetch.
 */
export function trimAfter(series: Series, ms: number): { series: Series; trimmed: number } {
  let end = series.t.length;
  while (end > 0) {
    const t = series.t[end - 1];
    if (t === undefined || t <= ms) break;
    end -= 1;
  }
  return {
    series: end === series.t.length ? series : sliceSeries(series, 0, end),
    trimmed: series.t.length - end,
  };
}

export function sliceSeries(series: Series, from: number, to: number): Series {
  return {
    id: series.id,
    tf: series.tf,
    t: series.t.slice(from, to),
    o: series.o.slice(from, to),
    h: series.h.slice(from, to),
    l: series.l.slice(from, to),
    c: series.c.slice(from, to),
    v: series.v.slice(from, to),
  };
}

export function withId(series: Series, id: string): Series {
  return { ...series, id };
}

/** Index of the first bar at or after `ms`, or `t.length` if there is none. */
export function indexAtOrAfter(series: Series, ms: number): number {
  const i = series.t.findIndex((t) => t >= ms);
  return i === -1 ? series.t.length : i;
}
