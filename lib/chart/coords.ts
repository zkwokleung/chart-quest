/**
 * Bar-index <-> pixel conversion, with the bounds checking the library does not do.
 *
 * Levels address data by bar index (`{ from: 812, to: 980 }`), not by timestamp,
 * so `coordinateToLogical` / `logicalToCoordinate` are the primitives the draw
 * tools need — not `coordinateToTime`.
 *
 * The library's internals are permissive in two ways that matter here:
 *
 *  - `indexToCoordinate` returns `0` for any non-integer index, which reads as a
 *    valid pixel at the very left edge of the chart.
 *  - it applies no bounds check to out-of-range integers, returning arithmetic
 *    for bars that do not exist.
 *
 * Both would surface as draw tools that silently anchor to nothing, so every
 * conversion goes through the guards below.
 */

export type LogicalBounds = {
  /** Inclusive first valid bar index. */
  min: number;
  /** Inclusive last valid bar index. */
  max: number;
};

export type ScaleAdapter = {
  coordinateToLogical(x: number): number | null;
  logicalToCoordinate(logical: number): number | null;
  coordinateToPrice(y: number): number | null;
  priceToCoordinate(price: number): number | null;
};

export function isValidLogical(
  logical: number | null | undefined,
  bounds: LogicalBounds,
): logical is number {
  return (
    typeof logical === "number" &&
    Number.isFinite(logical) &&
    Number.isInteger(logical) &&
    logical >= bounds.min &&
    logical <= bounds.max
  );
}

export function clampLogical(logical: number, bounds: LogicalBounds): number {
  return Math.min(bounds.max, Math.max(bounds.min, Math.round(logical)));
}

/**
 * Pointer x to bar index, or null when the pointer is off the data.
 *
 * The library returns fractional logicals mid-bar; rounding picks the nearest
 * bar, which is what a click on a candle means.
 */
export function xToBarIndex(
  scale: ScaleAdapter,
  x: number,
  bounds: LogicalBounds,
): number | null {
  const raw = scale.coordinateToLogical(x);
  if (raw === null || !Number.isFinite(raw)) return null;
  const rounded = Math.round(raw);
  return isValidLogical(rounded, bounds) ? rounded : null;
}

/** Bar index to pixel x, or null when the index is not a real bar. */
export function barIndexToX(
  scale: ScaleAdapter,
  index: number,
  bounds: LogicalBounds,
): number | null {
  if (!isValidLogical(index, bounds)) return null;
  const x = scale.logicalToCoordinate(index);
  return x === null || !Number.isFinite(x) ? null : x;
}

export function yToPrice(scale: ScaleAdapter, y: number): number | null {
  const price = scale.coordinateToPrice(y);
  return price === null || !Number.isFinite(price) ? null : price;
}

export function priceToY(scale: ScaleAdapter, price: number): number | null {
  if (!Number.isFinite(price)) return null;
  const y = scale.priceToCoordinate(price);
  return y === null || !Number.isFinite(y) ? null : y;
}
