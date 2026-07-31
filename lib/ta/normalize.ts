import { barAt, type Series } from "@/lib/chart/types";
import { atr, atrFraction } from "./atr";

/**
 * Turning prices into units that mean the same thing on every market.
 *
 * The epic calls this the mechanism that makes skills asset-portable, and the claim
 * is measurable rather than rhetorical. Median daily true range as a share of price:
 * Bitcoin 4.60%, SPY 1.11%, the euro 0.82%. A "big move" stated in dollars is a
 * different lesson on each of them; stated in ATR-multiples it is one lesson.
 *
 * **This is presentation, never scoring.** Every grader works in raw prices, and a
 * test asserts a fixture attempt earns an identical `Grade` in all three y-axis
 * modes. If normalization could move a score, `priceFracOfRange` would silently mean
 * three different things depending on a toggle the player controls.
 */

export type YAxisMode = "price" | "pct" | "atr";

/**
 * Percent change from an anchor bar's close.
 *
 * The anchor is usually the first bar of the level's window, so the axis reads
 * "how far has this moved since the chart started" — which is comparable across
 * assets in a way a dollar axis is not.
 */
export function toPct(
  series: Series<string>,
  anchorIndex: number,
): (number | null)[] {
  const anchor = barAt(series, anchorIndex)?.c;
  if (!anchor) return series.c.map(() => null);
  return series.c.map((close) => ((close - anchor) / anchor) * 100);
}

/**
 * Price expressed in ATR-multiples from an anchor.
 *
 * The ATR is taken **once, at the anchor**, rather than recomputed per bar. A
 * per-bar denominator would make the axis non-monotonic — price could rise while
 * the plotted value fell, because volatility grew underneath it — and an axis whose
 * ordering does not match price is worse than no axis at all.
 */
export function toAtrUnits(
  series: Series<string>,
  anchorIndex: number,
  period = 14,
): (number | null)[] {
  const anchor = barAt(series, anchorIndex)?.c;
  const unit = atr(series, anchorIndex, period);
  if (!anchor || unit <= 0) return series.c.map(() => null);
  return series.c.map((close) => (close - anchor) / unit);
}

/**
 * Converts one price into the current mode's units.
 *
 * Used by the axis formatter and by anything that has to label a price — a drawing,
 * a stop, a target — so the whole chart speaks one language at a time.
 */
export function toMode(
  price: number,
  mode: YAxisMode,
  series: Series<string>,
  anchorIndex: number,
  period = 14,
): number | null {
  if (mode === "price") return price;
  const anchor = barAt(series, anchorIndex)?.c;
  if (!anchor) return null;
  if (mode === "pct") return ((price - anchor) / anchor) * 100;
  const unit = atr(series, anchorIndex, period);
  return unit > 0 ? (price - anchor) / unit : null;
}

export function formatMode(value: number, mode: YAxisMode): string {
  if (mode === "pct") return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
  if (mode === "atr") return `${value >= 0 ? "+" : ""}${value.toFixed(2)}×`;
  return value.toFixed(2);
}

export { atrFraction };
