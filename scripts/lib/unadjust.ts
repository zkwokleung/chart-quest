import type { Series } from "../../lib/chart/types.ts";
import type { SplitEvent } from "../sources/yahoo.ts";

/**
 * Rebuilds the prices the tape actually printed, before splits were applied.
 *
 * No free source publishes genuinely unadjusted history — Yahoo's OHLC is already
 * split-adjusted. Level 1.7 ("The split trap") needs the unadjusted view, because
 * the lesson is that a chart can show a catastrophic-looking drop that never
 * happened. So we invert the adjustment using the split events Yahoo reports.
 *
 * A bar's factor is the product of every split dated after it: before a 4:1
 * split, the tape showed 4x the adjusted number.
 *
 * Volume is deliberately left alone. It adjusts in the opposite direction, and
 * level 1.7 is about price — inventing a volume series here would add noise the
 * player might mistake for signal.
 */
export function unadjustSplits<Id extends string>(
  series: Series<Id>,
  splits: SplitEvent[],
): Series<Id> {
  if (splits.length === 0) return { ...series };

  const factorAt = (t: number): number =>
    splits.reduce((acc, split) => (t < split.atMs ? acc * split.ratio : acc), 1);

  const factors = series.t.map(factorAt);
  const scale = (values: number[]) =>
    values.map((x, i) => Math.round(x * (factors[i] ?? 1) * 100) / 100);

  return {
    id: series.id,
    tf: series.tf,
    t: [...series.t],
    o: scale(series.o),
    h: scale(series.h),
    l: scale(series.l),
    c: scale(series.c),
    v: [...series.v],
  };
}
