"use client";

import { useState, type Ref } from "react";
import { Chart, type ChartHandle, type PriceScale } from "@/components/chart/Chart";
import type { Series } from "@/lib/chart/types";
import type { LevelSlice } from "@/lib/levels/schema";

type SliceChartProps = {
  slice: LevelSlice;
  series: Series<string>;
  /** Overrides `slice.to`, for kinds that reveal bars progressively. */
  to?: number;
  height?: number;
  showVolume?: boolean;
  /** Offers a log/linear toggle. Level 1.5 is entirely about this. */
  scaleToggle?: boolean;
  ref?: Ref<ChartHandle | null>;
};

/**
 * One chart for one level slice.
 *
 * Levels address data by bar index, so the slice is passed straight through as
 * the chart's range rather than the series being pre-cut — that keeps a bar's
 * index meaningful and identical to what the level file authored.
 */
export function SliceChart({
  slice,
  series,
  to,
  height = 380,
  showVolume = true,
  scaleToggle = false,
  ref,
}: SliceChartProps) {
  const [priceScale, setPriceScale] = useState<PriceScale>("linear");

  return (
    <figure className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <figcaption className="font-mono text-xs text-muted">
          {slice.label ?? slice.series}
        </figcaption>
        {scaleToggle ? (
          <button
            type="button"
            onClick={() =>
              setPriceScale((m) => (m === "linear" ? "logarithmic" : "linear"))
            }
            className="rounded border border-border px-2 py-1 text-xs hover:border-accent focus-visible:outline-2 focus-visible:outline-accent"
          >
            Scale: {priceScale}
          </button>
        ) : null}
      </div>
      <div className="rounded-lg border border-border bg-surface p-2">
        <Chart
          ref={ref}
          series={series}
          range={{ from: slice.from, to: to ?? slice.to }}
          priceScale={priceScale}
          showVolume={showVolume}
          height={height}
        />
      </div>
    </figure>
  );
}
