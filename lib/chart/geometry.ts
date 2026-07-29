import { barAt, type BarRange, type Series } from "./types";

/**
 * Geometry for player-drawn shapes.
 *
 * Pure functions over a series and a bar range, so the annotate grader can be
 * tested without a DOM. Every measure here answers a question a trader would ask
 * of a line: how many times did price respect it, did it cut through anything, and
 * was it drawn where price actually turned.
 */

export type Anchor = { bar: number; price: number };

export type Drawing =
  | { shape: "trendline"; a: Anchor; b: Anchor }
  | { shape: "level"; price: number }
  | { shape: "zone"; top: number; bottom: number }
  | { shape: "channel"; a: Anchor; b: Anchor; offset: number };

/** Which extreme a drawing is meant to track. */
export type Side = "support" | "resistance" | "both";

export type Tolerance = {
  /** Price tolerance as a fraction of the range's high-low span. */
  priceFracOfRange: number;
  barSlop: number;
};

/**
 * Tolerance in price terms, derived from the window the level shows.
 *
 * A fraction of the visible range rather than an absolute amount or an ATR
 * multiple: it is scale-free, so the same level config works on Bitcoin at 60,000
 * and EURUSD at 1.09.
 */
export function priceTolerance(
  series: Series<string>,
  range: BarRange,
  tolerance: Tolerance,
): number {
  return rangeSpan(series, range) * tolerance.priceFracOfRange;
}

export function rangeSpan(series: Series<string>, range: BarRange): number {
  let high = -Infinity;
  let low = Infinity;
  for (let i = range.from; i < range.to; i += 1) {
    const bar = barAt(series, i);
    if (!bar) continue;
    if (bar.h > high) high = bar.h;
    if (bar.l < low) low = bar.l;
  }
  return Number.isFinite(high) && Number.isFinite(low) ? high - low : 0;
}

/** The drawing's price at a bar, or null for shapes that have no single price. */
export function priceAtBar(drawing: Drawing, bar: number): number | null {
  switch (drawing.shape) {
    case "level":
      return drawing.price;
    case "trendline":
      return lineAt(drawing.a, drawing.b, bar);
    case "channel":
      return lineAt(drawing.a, drawing.b, bar);
    case "zone":
      return null;
  }
}

/** A channel's second rail, offset in price from the first. */
export function farPriceAtBar(drawing: Drawing, bar: number): number | null {
  if (drawing.shape !== "channel") return null;
  const near = lineAt(drawing.a, drawing.b, bar);
  return near === null ? null : near + drawing.offset;
}

function lineAt(a: Anchor, b: Anchor, bar: number): number | null {
  if (a.bar === b.bar) return null;
  const slope = (b.price - a.price) / (b.bar - a.bar);
  return a.price + slope * (bar - a.bar);
}

export function slopeOf(drawing: Drawing): number {
  if (drawing.shape === "level" || drawing.shape === "zone") return 0;
  if (drawing.a.bar === drawing.b.bar) return 0;
  return (drawing.b.price - drawing.a.price) / (drawing.b.bar - drawing.a.bar);
}

/**
 * Bars where price came within tolerance of the drawing on the relevant side.
 *
 * "Relevant" matters: a support line is respected by *lows* reaching it, and a
 * resistance line by *highs*. Counting both would let a line drawn through the
 * middle of the data score well.
 */
export function countTouches(
  drawing: Drawing,
  series: Series<string>,
  range: BarRange,
  tolerance: Tolerance,
  side: Side,
): number[] {
  const tol = priceTolerance(series, range, tolerance);
  const touched: number[] = [];

  for (let i = range.from; i < range.to; i += 1) {
    const bar = barAt(series, i);
    if (!bar) continue;

    if (drawing.shape === "zone") {
      if (
        Math.abs(bar.h - drawing.top) <= tol ||
        Math.abs(bar.l - drawing.bottom) <= tol
      ) {
        touched.push(i);
      }
      continue;
    }

    const near = priceAtBar(drawing, i);
    if (near === null) continue;
    const far = farPriceAtBar(drawing, i);

    const hits = (level: number) =>
      (side !== "resistance" && Math.abs(bar.l - level) <= tol) ||
      (side !== "support" && Math.abs(bar.h - level) <= tol);

    if (hits(near) || (far !== null && hits(far))) touched.push(i);
  }

  return touched;
}

/**
 * Bars whose body the drawing passes through.
 *
 * The mistake level 2.3 is built around. A line through a body means price traded
 * on both sides of it within one bar, so it was not acting as support or
 * resistance there — it was just a line on a chart.
 *
 * Tolerance is applied inward, so a line grazing a body edge is not counted:
 * anchoring exactly at an open or close is legitimate.
 */
export function countBodyCuts(
  drawing: Drawing,
  series: Series<string>,
  range: BarRange,
  tolerance: Tolerance,
): number[] {
  const tol = priceTolerance(series, range, tolerance);
  const cuts: number[] = [];

  for (let i = range.from; i < range.to; i += 1) {
    const bar = barAt(series, i);
    if (!bar) continue;

    const bodyLow = Math.min(bar.o, bar.c) + tol;
    const bodyHigh = Math.max(bar.o, bar.c) - tol;
    if (bodyHigh <= bodyLow) continue; // body thinner than the tolerance

    const levels =
      drawing.shape === "zone"
        ? [drawing.top, drawing.bottom]
        : [priceAtBar(drawing, i), farPriceAtBar(drawing, i)];

    for (const level of levels) {
      if (level === null) continue;
      if (level > bodyLow && level < bodyHigh) {
        cuts.push(i);
        break;
      }
    }
  }

  return cuts;
}

/**
 * Bars that closed through the drawing — a support line's invalidations.
 *
 * Distinct from a body cut: a close beyond the line means the level failed, which
 * is information rather than a drawing error. Chapter 3 grades on it directly.
 */
export function countClosesBeyond(
  drawing: Drawing,
  series: Series<string>,
  range: BarRange,
  tolerance: Tolerance,
  side: Side,
): number[] {
  const tol = priceTolerance(series, range, tolerance);
  const beyond: number[] = [];

  for (let i = range.from; i < range.to; i += 1) {
    const bar = barAt(series, i);
    if (!bar) continue;
    const level = priceAtBar(drawing, i);
    if (level === null) continue;

    if (side === "support" && bar.c < level - tol) beyond.push(i);
    if (side === "resistance" && bar.c > level + tol) beyond.push(i);
  }

  return beyond;
}

export type AnchorQuality = "wick" | "body" | "off";

/**
 * Whether an anchor sits on the bar's extreme, inside its body, or nowhere near.
 *
 * A trendline anchored to bodies rather than wicks is the single most common
 * beginner error, and naming it is what turns a low score into a lesson.
 */
export function anchorQuality(
  anchor: Anchor,
  series: Series<string>,
  range: BarRange,
  tolerance: Tolerance,
): AnchorQuality {
  const bar = barAt(series, anchor.bar);
  if (!bar) return "off";
  const tol = priceTolerance(series, range, tolerance);

  if (
    Math.abs(anchor.price - bar.h) <= tol ||
    Math.abs(anchor.price - bar.l) <= tol
  ) {
    return "wick";
  }
  if (anchor.price >= Math.min(bar.o, bar.c) && anchor.price <= Math.max(bar.o, bar.c)) {
    return "body";
  }
  return "off";
}

export function anchorsOf(drawing: Drawing): Anchor[] {
  switch (drawing.shape) {
    case "trendline":
    case "channel":
      return [drawing.a, drawing.b];
    case "level":
    case "zone":
      return [];
  }
}
