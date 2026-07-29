"use client";

import {
  CandlestickSeries,
  createChart,
  HistogramSeries,
  PriceScaleMode,
  type IChartApi,
  type ISeriesApi,
  type Logical,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import type { LogicalBounds, ScaleAdapter } from "@/lib/chart/coords";
import { clampRange, toCandlestickData, toVolumeData } from "@/lib/chart/to-lwc";
import type { BarRange, Series } from "@/lib/chart/types";

export type PriceScale = "linear" | "logarithmic";

/**
 * What level kinds get to reach for. Draw tools need pixel <-> bar-index
 * conversion; everything else about the chart stays private to this component.
 *
 * Callers should pass this through `lib/chart/coords.ts` rather than using it
 * raw — those helpers add the bounds checking the library omits.
 */
export type ChartHandle = {
  scale: ScaleAdapter;
  bounds: LogicalBounds;
};

type ChartProps = {
  series: Series;
  range?: BarRange;
  priceScale?: PriceScale;
  showVolume?: boolean;
  height?: number;
  className?: string;
  ref?: Ref<ChartHandle | null>;
};

const CANDLE_UP = "#3fb98e";
const CANDLE_DOWN = "#e2603f";

export function Chart({
  series,
  range,
  priceScale = "linear",
  showVolume = true,
  height = 420,
  className,
  ref,
}: ChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  const { from, to } = clampRange(series, range);

  useImperativeHandle(
    ref,
    () => ({
      scale: {
        coordinateToLogical: (x) =>
          chartRef.current?.timeScale().coordinateToLogical(x) ?? null,
        logicalToCoordinate: (logical) =>
          chartRef.current
            ?.timeScale()
            // `Logical` is a nominal brand over number; the guards in
            // lib/chart/coords.ts are what actually validate the value.
            .logicalToCoordinate(logical as Logical) ?? null,
        coordinateToPrice: (y) =>
          candlesRef.current?.coordinateToPrice(y) ?? null,
        priceToCoordinate: (price) =>
          candlesRef.current?.priceToCoordinate(price) ?? null,
      },
      // Logical indices are relative to the data handed to setData, so a level
      // rendering bars 812..980 sees 0..168 here. Callers translate by `from`.
      bounds: { min: 0, max: Math.max(0, to - from - 1) },
    }),
    [from, to],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      height,
      layout: {
        background: { color: "transparent" },
        textColor: "#9aa4b2",
        attributionLogo: false,
        panes: { separatorColor: "#2a3140" },
      },
      grid: {
        vertLines: { color: "#1d2430" },
        horzLines: { color: "#1d2430" },
      },
      crosshair: { mode: 0 },
      rightPriceScale: { borderColor: "#2a3140" },
      timeScale: { borderColor: "#2a3140", rightOffset: 2 },
    });

    // v5 takes a series definition rather than the v4 addCandlestickSeries().
    const candles = chart.addSeries(CandlestickSeries, {
      upColor: CANDLE_UP,
      downColor: "transparent",
      borderUpColor: CANDLE_UP,
      borderDownColor: CANDLE_DOWN,
      wickUpColor: CANDLE_UP,
      wickDownColor: CANDLE_DOWN,
      borderVisible: true,
    });

    chartRef.current = chart;
    candlesRef.current = candles;

    const resize = new ResizeObserver(([entry]) => {
      if (entry) chart.applyOptions({ width: entry.contentRect.width });
    });
    resize.observe(container);

    return () => {
      resize.disconnect();
      chart.remove();
      chartRef.current = null;
      candlesRef.current = null;
    };
  }, [height]);

  useEffect(() => {
    const chart = chartRef.current;
    const candles = candlesRef.current;
    if (!chart || !candles) return;

    candles.setData(toCandlestickData(series, { from, to }));

    let volume: ISeriesApi<"Histogram"> | null = null;
    if (showVolume) {
      // Pane 1: v5 has real panes, so volume no longer needs the overlaid
      // price-scale trick v4 required.
      volume = chart.addSeries(
        HistogramSeries,
        { priceFormat: { type: "volume" }, color: "#39424f", priceLineVisible: false },
        1,
      );
      volume.setData(toVolumeData(series, { from, to }));
      chart.panes()[1]?.setStretchFactor(0.25);
    }

    chart.timeScale().fitContent();

    return () => {
      if (volume) chart.removeSeries(volume);
    };
  }, [series, from, to, showVolume]);

  useEffect(() => {
    candlesRef.current?.priceScale().applyOptions({
      mode:
        priceScale === "logarithmic"
          ? PriceScaleMode.Logarithmic
          : PriceScaleMode.Normal,
    });
  }, [priceScale]);

  return (
    <div
      ref={containerRef}
      className={className}
      role="img"
      aria-label={`Price chart, ${series.id}, ${to - from} bars`}
    />
  );
}

export type { UTCTimestamp };
