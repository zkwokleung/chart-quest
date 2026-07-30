"use client";

import type { Ref } from "react";
import type { ChartHandle } from "@/components/chart/Chart";
import type { RenderableDrawing } from "@/components/chart/DrawingPrimitive";
import { SliceChart } from "@/components/level/SliceChart";
import type { LevelSlice } from "@/lib/levels/schema";
import type { ReplayFeed } from "@/lib/replay/feed";
import { useFeed } from "@/lib/replay/use-feed";

type FeedChartProps = {
  slice: LevelSlice;
  feed: ReplayFeed;
  height?: number;
  showVolume?: boolean;
  scaleToggle?: boolean;
  drawings?: RenderableDrawing[];
  ref?: Ref<ChartHandle | null>;
};

/**
 * One chart driven by one feed.
 *
 * Exists because each feed needs its own subscription and hooks cannot be called
 * from inside a `.map()` — a level showing six charts needs six components, not
 * six hook calls in a loop. It is also the only place that knows the chart's
 * window follows the reveal point rather than the slice's end.
 */
export function FeedChart({
  slice,
  feed,
  height,
  showVolume,
  scaleToggle,
  drawings,
  ref,
}: FeedChartProps) {
  const { at, series } = useFeed(feed);

  return (
    <SliceChart
      slice={slice}
      series={series}
      // The revealed window, which is shorter than the slice mid-replay and
      // longer than it once a kind has revealed past the end.
      to={at + 1}
      height={height}
      showVolume={showVolume}
      scaleToggle={scaleToggle}
      drawings={drawings}
      ref={ref}
    />
  );
}
