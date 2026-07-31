import { barAt, type BarRange, type Series } from "@/lib/chart/types";
import { findSwings, type Swing } from "./swings";

/**
 * Candlestick and chart pattern detection.
 *
 * **Every threshold here is a choice, and they are named constants rather than
 * numbers inside a condition for that reason.** An SMA has one correct answer; a pin
 * bar does not. Ask three traders where a wick stops being long and you get three
 * replies, so the honest move is to put the line somewhere defensible, say where, and
 * let it be argued with — a detector whose constants are buried is one nobody can
 * disagree with, which is not the same as one nobody disagrees with.
 *
 * It matters more than usual because Chapter 4's base rates are computed from these
 * definitions. Loosen `PIN_MAX_BODY` and every pin-bar win rate in the game moves.
 * `base-rates.json` records the definition alongside the numbers for the same reason.
 */

/** A body no larger than this share of the bar's range. */
export const PIN_MAX_BODY = 1 / 3;
/** One wick at least this share of the range, for a pin bar. */
export const PIN_MIN_WICK = 0.6;
/** A body no larger than this share of the range, for a doji. */
export const DOJI_MAX_BODY = 0.1;
/** An engulfing body must exceed the one it swallows by this much. */
export const ENGULF_MIN_GROWTH = 1.1;

/** Two tops count as level if they sit within this fraction of each other. */
export const DOUBLE_TOP_TOLERANCE = 0.02;
/** The trough between them must be at least this far below. */
export const DOUBLE_TOP_MIN_TROUGH = 0.03;
/** A head must exceed both shoulders by at least this much. */
export const HEAD_MIN_PROMINENCE = 0.02;
/** The two shoulders count as level within this fraction. */
export const SHOULDER_TOLERANCE = 0.04;

export type PatternKind =
  | "pin-bar"
  | "doji"
  | "engulfing"
  | "double-top"
  | "head-and-shoulders";

export const PATTERN_KINDS: readonly PatternKind[] = [
  "pin-bar",
  "doji",
  "engulfing",
  "double-top",
  "head-and-shoulders",
];

export type PatternHit = {
  kind: PatternKind;
  /** The bar the pattern completes on — what a player would click. */
  bar: number;
  direction: "bullish" | "bearish";
  /**
   * Every bar the pattern is made of, in time order.
   *
   * A single candle is its own component; a head and shoulders has three. 4.4 asks
   * the player to mark the parts, and the correction overlay highlights them, so the
   * detector has to know what they are rather than only where the pattern ended.
   */
  components: number[];
};

export function findPatterns(
  series: Series<string>,
  kind: PatternKind,
  range?: BarRange,
): PatternHit[] {
  const from = Math.max(1, range?.from ?? 0);
  const to = Math.min(series.t.length, range?.to ?? series.t.length);

  if (kind === "double-top" || kind === "head-and-shoulders") {
    return chartPatterns(series, kind, { from, to });
  }

  const out: PatternHit[] = [];
  for (let i = from; i < to; i += 1) {
    const hit = candleAt(series, i, kind);
    if (hit) out.push(hit);
  }
  return out;
}

/** Every pattern of every kind in a range, in bar order. */
export function findAllPatterns(
  series: Series<string>,
  range?: BarRange,
): PatternHit[] {
  return PATTERN_KINDS.flatMap((kind) => findPatterns(series, kind, range)).sort(
    (a, b) => a.bar - b.bar,
  );
}

function candleAt(
  series: Series<string>,
  index: number,
  kind: PatternKind,
): PatternHit | null {
  const bar = barAt(series, index);
  if (!bar) return null;

  const range = bar.h - bar.l;
  if (range <= 0) return null;
  const body = Math.abs(bar.c - bar.o);
  const upper = bar.h - Math.max(bar.o, bar.c);
  const lower = Math.min(bar.o, bar.c) - bar.l;

  if (kind === "doji") {
    if (body / range > DOJI_MAX_BODY) return null;
    // A doji is indecision rather than a direction, so it is reported as bullish
    // only when its close is the higher of the two — which is nearly arbitrary, and
    // is why 4.5 measures it as a *signal* and finds it near a coin flip.
    return {
      kind,
      bar: index,
      direction: bar.c >= bar.o ? "bullish" : "bearish",
      components: [index],
    };
  }

  if (kind === "pin-bar") {
    if (body / range > PIN_MAX_BODY) return null;
    const longLower = lower / range >= PIN_MIN_WICK;
    const longUpper = upper / range >= PIN_MIN_WICK;
    if (!longLower && !longUpper) return null;
    // The wick points at where price was rejected, so a long lower wick is the
    // bullish one.
    return {
      kind,
      bar: index,
      direction: longLower ? "bullish" : "bearish",
      components: [index],
    };
  }

  // Engulfing: this body swallows the previous one and is decisively bigger.
  const previous = barAt(series, index - 1);
  if (!previous) return null;
  const previousBody = Math.abs(previous.c - previous.o);
  if (previousBody <= 0 || body <= previousBody * ENGULF_MIN_GROWTH) return null;

  const bullish =
    bar.c > bar.o &&
    previous.c < previous.o &&
    bar.c >= previous.o &&
    bar.o <= previous.c;
  const bearish =
    bar.c < bar.o &&
    previous.c > previous.o &&
    bar.c <= previous.o &&
    bar.o >= previous.c;
  if (!bullish && !bearish) return null;

  return {
    kind: "engulfing",
    bar: index,
    direction: bullish ? "bullish" : "bearish",
    components: [index - 1, index],
  };
}

/**
 * A run of ties is one swing, not seven.
 *
 * `findSwings` qualifies a bar when no neighbour is *strictly* more extreme, so a flat
 * stretch marks every bar in it — on purpose, since a level reading "no structure
 * here" wants exactly that. A chart pattern needs the alternating sequence
 * underneath, so a run of one kind collapses to its most extreme member.
 */
function condenseSwings(swings: Swing[]): Swing[] {
  const out: Swing[] = [];
  for (const swing of swings) {
    const last = out.at(-1);
    if (!last || last.kind !== swing.kind) {
      out.push(swing);
      continue;
    }
    const moreExtreme =
      swing.kind === "high" ? swing.price > last.price : swing.price < last.price;
    if (moreExtreme) out[out.length - 1] = swing;
  }
  return out;
}

/**
 * Double tops and head-and-shoulders, from the fractal swings.
 *
 * Built on `findSwings` rather than a second detector so the game has one definition
 * of "a swing". Levels 2.1 and 3.3 are graded against it, and a chart pattern made of
 * swings the player was taught to find elsewhere is one they can actually verify.
 *
 * Both are bearish topping patterns. The bullish mirrors exist and are not detected,
 * because no Chapter 4 level asks for them and a detector nothing uses is a detector
 * nothing tests.
 */
function chartPatterns(
  series: Series<string>,
  kind: "double-top" | "head-and-shoulders",
  range: BarRange,
): PatternHit[] {
  const swings = condenseSwings(findSwings(series, range, 4));
  const out: PatternHit[] = [];

  if (kind === "double-top") {
    for (let i = 0; i + 2 < swings.length; i += 1) {
      const [left, trough, right] = [swings[i], swings[i + 1], swings[i + 2]];
      if (!left || !trough || !right) continue;
      if (left.kind !== "high" || trough.kind !== "low" || right.kind !== "high") {
        continue;
      }
      // A bar can be both a high and a low in a flat neighbourhood, which would
      // otherwise let a single bar play two of the three parts.
      if (!(left.bar < trough.bar && trough.bar < right.bar)) continue;
      if (Math.abs(right.price - left.price) / left.price > DOUBLE_TOP_TOLERANCE) {
        continue;
      }
      // Without a real trough between them this is one top with a wobble.
      if ((left.price - trough.price) / left.price < DOUBLE_TOP_MIN_TROUGH) continue;
      out.push({
        kind,
        bar: right.bar,
        direction: "bearish",
        components: [left.bar, trough.bar, right.bar],
      });
    }
    return out;
  }

  const highs = swings.filter((s): s is Swing => s.kind === "high");
  for (let i = 0; i + 2 < highs.length; i += 1) {
    const [left, head, right] = [highs[i], highs[i + 1], highs[i + 2]];
    if (!left || !head || !right) continue;
    const prominent =
      head.price > left.price * (1 + HEAD_MIN_PROMINENCE) &&
      head.price > right.price * (1 + HEAD_MIN_PROMINENCE);
    if (!prominent) continue;
    if (Math.abs(right.price - left.price) / left.price > SHOULDER_TOLERANCE) continue;
    out.push({
      kind,
      bar: right.bar,
      direction: "bearish",
      components: [left.bar, head.bar, right.bar],
    });
  }
  return out;
}
