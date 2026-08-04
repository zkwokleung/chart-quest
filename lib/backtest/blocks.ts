import type { Series } from "@/lib/chart/types";
import { atrFraction } from "@/lib/ta/atr";
import { bollingerSeries } from "@/lib/ta/bollinger";
import { macdSeries, MACD_DEFAULTS, type MacdParams } from "@/lib/ta/macd";
import { emaSeries, smaSeries } from "@/lib/ta/moving-average";
import { rsiSeries } from "@/lib/ta/rsi";
import { findSwings, type Swing } from "@/lib/ta/swings";
import type { StrategySpec } from "./engine";

/**
 * The composer's vocabulary, and how a stack of blocks becomes one entry predicate.
 *
 * ## Every block is a condition the player has already met
 *
 * Nothing here is new technique. `structure` is Chapter 2's break, `zone` is Chapter 3's level,
 * `cross` and `compare` are Chapter 5's indicators, `volatility` is Chapter 8's ATR-as-a-share.
 * That is what makes the palette meaningful as a *reward*: it is the chapters, in a menu. What the
 * player composes is therefore something they can read, which is the difference between building a
 * strategy and generating one.
 *
 * ## Two divergences from `ARCHITECTURE.md` §7, both forced
 *
 * §7 sketched blocks referencing an `IndicatorRef`, and the type that actually exists is
 * `IndicatorSpec` in `lib/chart/indicator-data.ts` — which describes **what to draw**. A rule needs
 * a single number per bar, and Bollinger and MACD have three lines each, so a spec that is complete
 * for drawing is ambiguous for deciding. Blocks therefore carry their own `Signal`, which names one
 * line. The two types stay separate because they answer different questions.
 *
 * §7 also wrote `event: "bos"`, with no direction. A break of structure upward and downward are
 * opposite signals, and a composer that lets the player pick a side cannot leave that to be
 * inferred, so it is `bos-up` and `bos-down`.
 *
 * ## Indicators are computed once per series, not once per bar
 *
 * `rsi(series, i)` builds the whole RSI series on every call, and a backtest asks about every bar:
 * on a 4,612-bar series that is 21 million operations and several seconds. So `compileEntry` closes
 * over a `WeakMap` cache keyed by the series, and each signal's full array is built at most once.
 * The predicate then reads index `i` out of an array — which is also what keeps it structurally
 * incapable of looking forward, because it never chooses an index.
 *
 * A `WeakMap` rather than a `Map`, so a cache cannot pin a 4,600-bar series in memory after the
 * composer has moved on. And the cache lives inside the returned closure rather than at module
 * scope: two strategies compiled from identical blocks must not share mutable state, or a test
 * that passes alone starts failing when another runs first.
 */

export type BlockKind = "cross" | "compare" | "structure" | "zone" | "volatility";

/** One number per bar. Named rather than derived, because a rule cannot decide from three lines. */
export type Signal =
  | { kind: "close" }
  | { kind: "sma"; period: number }
  | { kind: "ema"; period: number }
  | { kind: "rsi"; period: number }
  | { kind: "atr-pct"; period: number }
  | {
      kind: "bollinger";
      period: number;
      deviations: number;
      band: "upper" | "mid" | "lower";
    }
  | { kind: "macd"; line: "macd" | "signal" | "histogram"; params?: MacdParams };

export type Block =
  | { kind: "cross"; fast: Signal; slow: Signal; dir: "above" | "below" }
  | { kind: "compare"; left: Signal; op: "<" | ">"; right: number | Signal }
  | {
      kind: "structure";
      event: "bos-up" | "bos-down" | "swing-high" | "swing-low" | "retest";
    }
  | { kind: "zone"; touching: "support" | "resistance" }
  | { kind: "volatility"; atrPct: { op: "<" | ">"; value: number } };

/**
 * Bars either side of a swing before it counts as one.
 *
 * `patterns.ts`' `SWING_LOOKBACK`, deliberately the same number: a swing high that Chapter 4's
 * pattern detector will not admit until four bars have failed to exceed it cannot be admitted here
 * three bars earlier. The game would then have two definitions of a swing, and the one a rule
 * traded on would be the looser.
 */
export const SWING_K = 4;

/** How far price may sit from a level and still count as touching it, in ATR. */
const ZONE_TOUCH_ATR = 0.25;

type Cache = {
  signals: Map<string, (number | null)[]>;
  swings?: Swing[];
};

function keyOf(signal: Signal): string {
  switch (signal.kind) {
    case "close":
      return "close";
    case "sma":
    case "ema":
    case "rsi":
    case "atr-pct":
      return `${signal.kind}:${signal.period}`;
    case "bollinger":
      return `bb:${signal.period}:${signal.deviations}:${signal.band}`;
    case "macd": {
      const p = signal.params ?? MACD_DEFAULTS;
      return `macd:${p.fast}:${p.slow}:${p.signal}:${signal.line}`;
    }
  }
}

function computeSignal(signal: Signal, series: Series<string>): (number | null)[] {
  switch (signal.kind) {
    case "close":
      return series.c.map((c) => c ?? null);
    case "sma":
      return smaSeries(series, signal.period);
    case "ema":
      return emaSeries(series, signal.period);
    case "rsi":
      return rsiSeries(series, signal.period);
    case "atr-pct":
      // As a percentage, so a threshold a player types means the same thing on every market —
      // which is the entire content of Chapter 8's y-axis toggle, turned into a rule.
      return series.c.map((_c, i) => atrFraction(series, i, signal.period) * 100);
    case "bollinger": {
      const points = bollingerSeries(series, signal.period, signal.deviations);
      return points.map((point) => {
        if (!point) return null;
        return signal.band === "upper"
          ? point.upper
          : signal.band === "lower"
            ? point.lower
            : point.middle;
      });
    }
    case "macd": {
      const points = macdSeries(series, signal.params ?? MACD_DEFAULTS);
      return points.map((point) => (point ? point[signal.line] : null));
    }
  }
}

/**
 * How many bars a signal needs before its value means anything.
 *
 * Two regimes, and the distinction is not pedantry. A simple mean is exact the moment it has its
 * window, so `sma(20)` is trustworthy at bar 20. Wilder's RSI smoothing and the MACD's EMAs carry a
 * transient from their seed that decays geometrically, so their first defined value is not their
 * converged one — the convention is three periods, and using one would let a strategy trade on a
 * number that is still settling.
 */
function warmupOf(signal: Signal): number {
  switch (signal.kind) {
    case "close":
      return 1;
    case "sma":
    case "atr-pct":
      return signal.period + 1;
    case "bollinger":
      return signal.period + 1;
    case "ema":
    case "rsi":
      return signal.period * 3;
    case "macd": {
      const p = signal.params ?? MACD_DEFAULTS;
      return (p.slow + p.signal) * 3;
    }
  }
}

/** Structure and zone blocks need enough history for swings to exist and be confirmed. */
const STRUCTURE_WARMUP = 60;

/** The volatility block's own signal. Fixed at 14 — the period every ATR in the game uses. */
const ATR_PCT_14: Signal = { kind: "atr-pct", period: 14 };

export function warmupFor(blocks: readonly Block[]): number {
  const needs: number[] = [2];
  for (const block of blocks) {
    switch (block.kind) {
      case "cross":
        needs.push(warmupOf(block.fast) + 1, warmupOf(block.slow) + 1);
        break;
      case "compare":
        needs.push(warmupOf(block.left));
        if (typeof block.right !== "number") needs.push(warmupOf(block.right));
        break;
      case "volatility":
        needs.push(warmupOf(ATR_PCT_14));
        break;
      case "structure":
      case "zone":
        needs.push(STRUCTURE_WARMUP);
        break;
    }
  }
  return Math.max(...needs);
}

/**
 * Swings confirmed as of bar `i`.
 *
 * Computed over the whole series once and then filtered by confirmation, which is the only form
 * that is both fast and honest: a swing at bar `b` is not knowable until `b + SWING_K`, so
 * including it earlier would be look-ahead wearing a helper function's clothes. `patterns.ts` draws
 * the same line with `confirmedAt`.
 */
function confirmedSwings(cache: Cache, series: Series<string>, i: number): Swing[] {
  cache.swings ??= findSwings(series, { from: 0, to: series.c.length }, SWING_K);
  return cache.swings.filter((swing) => swing.bar + SWING_K <= i);
}

/**
 * A stack of blocks as one predicate: every block must hold on the same bar.
 *
 * `all` rather than `any`, per §7 — and it is the conservative choice for a reason beyond fidelity
 * to the spec. Chapter 6 spent a chapter on over-confluence, so a player who stacks five conditions
 * should watch their trade count collapse. An `any` composer would reward stacking, which teaches
 * the opposite of 6.5.
 *
 * An empty stack returns false, not true. "No conditions" is an unfinished strategy rather than one
 * that fires on every bar, and a vacuous truth here would hand the player 4,000 trades and a
 * plausible-looking expectancy.
 */
export function compileEntry(blocks: readonly Block[]): StrategySpec["entry"] {
  const caches = new WeakMap<Series<string>, Cache>();
  const cacheFor = (series: Series<string>): Cache => {
    let cache = caches.get(series);
    if (!cache) {
      cache = { signals: new Map() };
      caches.set(series, cache);
    }
    return cache;
  };

  const valuesOf = (
    cache: Cache,
    series: Series<string>,
    signal: Signal,
  ): (number | null)[] => {
    const key = keyOf(signal);
    let values = cache.signals.get(key);
    if (!values) {
      values = computeSignal(signal, series);
      cache.signals.set(key, values);
    }
    return values;
  };

  if (blocks.length === 0) return () => false;

  return (series, i) => {
    if (i <= 0 || i >= series.c.length) return false;
    const cache = cacheFor(series);

    const at = (signal: Signal, bar: number): number | null =>
      valuesOf(cache, series, signal)[bar] ?? null;

    const resolve = (side: number | Signal, bar: number): number | null =>
      typeof side === "number" ? side : at(side, bar);

    for (const block of blocks) {
      switch (block.kind) {
        case "cross": {
          // A cross is a two-bar event: on the wrong side then, on the right side now. Testing
          // only "now" would fire on every bar of a trend rather than on the one that turned.
          const fastNow = at(block.fast, i);
          const slowNow = at(block.slow, i);
          const fastBefore = at(block.fast, i - 1);
          const slowBefore = at(block.slow, i - 1);
          if (
            fastNow === null ||
            slowNow === null ||
            fastBefore === null ||
            slowBefore === null
          ) {
            return false;
          }
          const crossed =
            block.dir === "above"
              ? fastBefore <= slowBefore && fastNow > slowNow
              : fastBefore >= slowBefore && fastNow < slowNow;
          if (!crossed) return false;
          break;
        }

        case "compare": {
          const left = at(block.left, i);
          const right = resolve(block.right, i);
          if (left === null || right === null) return false;
          if (block.op === ">" ? !(left > right) : !(left < right)) return false;
          break;
        }

        case "volatility": {
          const value = at(ATR_PCT_14, i);
          if (value === null) return false;
          const { op, value: threshold } = block.atrPct;
          if (op === ">" ? !(value > threshold) : !(value < threshold)) return false;
          break;
        }

        case "structure": {
          const swings = confirmedSwings(cache, series, i);
          if (swings.length < 2) return false;
          const close = series.c[i];
          if (close === undefined) return false;

          const highs = swings.filter((s) => s.kind === "high");
          const lows = swings.filter((s) => s.kind === "low");
          const lastHigh = highs.at(-1);
          const lastLow = lows.at(-1);

          if (block.event === "bos-up") {
            if (!lastHigh || !(close > lastHigh.price)) return false;
          } else if (block.event === "bos-down") {
            if (!lastLow || !(close < lastLow.price)) return false;
          } else if (block.event === "swing-high") {
            if (!lastHigh || lastHigh.bar + SWING_K !== i) return false;
          } else if (block.event === "swing-low") {
            if (!lastLow || lastLow.bar + SWING_K !== i) return false;
          } else {
            // A retest: price broke the last swing high earlier and has come back to it. Chapter
            // 3.4's setup, and the reason `zone` is not enough on its own — a level matters more
            // once it has already been broken.
            if (!lastHigh) return false;
            const broke = series.c
              .slice(lastHigh.bar + SWING_K, i)
              .some((c) => c !== undefined && c > lastHigh.price);
            if (!broke) return false;
            const room = atrFraction(series, i) * (series.c[i] ?? 0) * ZONE_TOUCH_ATR;
            if (Math.abs(close - lastHigh.price) > room) return false;
          }
          break;
        }

        case "zone": {
          const swings = confirmedSwings(cache, series, i);
          const wanted = block.touching === "support" ? "low" : "high";
          const levels = swings.filter((s) => s.kind === wanted);
          if (levels.length === 0) return false;
          const bar = series.c[i];
          const low = series.l[i];
          const high = series.h[i];
          if (bar === undefined || low === undefined || high === undefined) return false;
          const room = atrFraction(series, i) * bar * ZONE_TOUCH_ATR;
          // The bar's *range* has to reach the level, not its close: 1.2's lesson is that a wick
          // is where price actually went.
          const touched = levels.some(
            (level) => low - room <= level.price && level.price <= high + room,
          );
          if (!touched) return false;
          break;
        }
      }
    }

    return true;
  };
}

/** Every block kind, for the palette and its test. */
export const BLOCK_KINDS: readonly BlockKind[] = [
  "cross",
  "compare",
  "structure",
  "zone",
  "volatility",
];
