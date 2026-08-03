"use client";

import { useState, type Ref } from "react";
import {
  Chart,
  type ChartHandle,
  type PriceScale,
} from "@/components/chart/Chart";
import type { Series } from "@/lib/chart/types";
import type { RenderableDrawing } from "@/components/chart/DrawingPrimitive";
import type { IndicatorSpec } from "@/lib/chart/indicator-data";
import { YAxisToggle } from "@/components/chart/YAxisToggle";
import type { LevelSlice } from "@/lib/levels/schema";
import type { YAxisOption } from "@/lib/levels/y-axis";
import { useGameStore } from "@/lib/store/game";
import type { YAxisMode } from "@/lib/ta/normalize";

type SliceChartProps = {
  slice: LevelSlice;
  series: Series<string>;
  /** Overrides `slice.to`, for kinds that reveal bars progressively. */
  to?: number;
  height?: number;
  showVolume?: boolean;
  /** Offers a log/linear toggle. Level 1.5 is entirely about this. */
  scaleToggle?: boolean;
  drawings?: RenderableDrawing[];
  indicators?: readonly IndicatorSpec[];
  /**
   * Whether to offer the price / % / ATR toggle, and what mode to open in.
   *
   * Resolved by `yAxisFor`, which is where the rule lives — a level opts in through
   * `Level.yAxis`, and Chapter 8 turns it on everywhere. Undefined means no control.
   */
  yAxis?: YAxisOption;
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
  drawings,
  indicators,
  yAxis,
  ref,
}: SliceChartProps) {
  const [priceScale, setPriceScale] = useState<PriceScale>("linear");
  // The level's default, then the player's own preference, then price. The stored
  // setting has existed since M1 and until now was read by nothing.
  const stored = useGameStore((state) => state.profile.settings.yAxisMode);
  const [yAxisMode, setYAxisMode] = useState<YAxisMode>(yAxis?.mode ?? stored);

  return (
    <figure className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <figcaption className="font-mono text-xs text-muted">
          {slice.label ?? slice.series}
        </figcaption>
        <span className="flex items-center gap-2">
          {yAxis?.toggle ? (
            <YAxisToggle mode={yAxisMode} onChange={setYAxisMode} />
          ) : null}
          {scaleToggle ? (
            <button
              type="button"
              onClick={() =>
                setPriceScale((m) =>
                  m === "linear" ? "logarithmic" : "linear",
                )
              }
              className="rounded border border-border px-2 py-1 text-xs hover:border-accent focus-visible:outline-2 focus-visible:outline-accent"
            >
              Scale: {priceScale}
            </button>
          ) : null}
        </span>
      </div>
      <div className="rounded-lg border border-border bg-surface p-2">
        <Chart
          ref={ref}
          series={series}
          range={{ from: slice.from, to: to ?? slice.to }}
          priceScale={priceScale}
          showVolume={showVolume}
          height={height}
          drawings={drawings}
          indicators={indicators}
          yAxisMode={yAxisMode}
        />
      </div>
    </figure>
  );
}
