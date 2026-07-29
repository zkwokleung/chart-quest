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
import { barIndexToX, priceToY } from "@/lib/chart/coords";
import { clampRange, toCandlestickData, toVolumeData } from "@/lib/chart/to-lwc";
import type { BarRange, Series } from "@/lib/chart/types";
import { DrawingsPrimitive, type RenderableDrawing } from "./DrawingPrimitive";

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
  series: Series<string>;
  range?: BarRange;
  priceScale?: PriceScale;
  showVolume?: boolean;
  height?: number;
  className?: string;
  /**
   * Player drawings and reference overlays, in absolute bar indices. Read on every
   * frame, so mutating the returned array between renders is enough to repaint.
   */
  drawings?: RenderableDrawing[];
  ref?: Ref<ChartHandle | null>;
};

const CANDLE_UP = "#3fb98e";
const CANDLE_DOWN = "#e2603f";

/**
 * The library's coordinate conversions, gathered behind one interface.
 *
 * Callers go through `lib/chart/coords.ts` rather than using these directly —
 * `logicalToCoordinate` returns plausible pixels for bars that do not exist, and
 * the guards there are what reject them.
 */
function scaleAdapterFor(
  chart: IChartApi,
  series: ISeriesApi<"Candlestick">,
): ScaleAdapter {
  return {
    coordinateToLogical: (x) => chart.timeScale().coordinateToLogical(x),
    // `Logical` is a nominal brand over number; validation lives in the guards.
    logicalToCoordinate: (logical) =>
      chart.timeScale().logicalToCoordinate(logical as Logical),
    coordinateToPrice: (y) => series.coordinateToPrice(y),
    priceToCoordinate: (price) => series.priceToCoordinate(price),
  };
}

export function Chart({
  series,
  range,
  priceScale = "linear",
  showVolume = true,
  height = 420,
  className,
  drawings,
  ref,
}: ChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  const { from, to } = clampRange(series, range);

  const primitiveRef = useRef<DrawingsPrimitive | null>(null);
  // The primitive is created once with the chart but must know the current window
  // to convert absolute bar indices. Written in an effect, never during render.
  const windowRef = useRef({ from, to });

  useImperativeHandle(
    ref,
    () => ({
      scale: {
        coordinateToLogical: (x) =>
          chartRef.current?.timeScale().coordinateToLogical(x) ?? null,
        logicalToCoordinate: (logical) =>
          chartRef.current?.timeScale().logicalToCoordinate(logical as Logical) ?? null,
        coordinateToPrice: (y) => candlesRef.current?.coordinateToPrice(y) ?? null,
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
      timeScale: {
        borderColor: "#2a3140",
        rightOffset: 2,
        // The default floor (0.5px/bar) makes fitContent unable to show a
        // 4,600-bar series in one screen, which would hide 2008 on SPY entirely.
        // Chapter 8 compares regimes across decades, so full history has to fit.
        minBarSpacing: 0.04,
      },
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

    // The volume series is created here, alongside the chart, so its lifetime
    // matches the chart's. Creating it in the data effect instead meant that on
    // unmount React ran this effect's cleanup first — destroying the chart — and
    // then called removeSeries on the destroyed chart, crashing the renderer.
    if (showVolume) {
      // Pane 1: v5 has real panes, so volume no longer needs the overlaid
      // price-scale trick v4 required.
      const volume = chart.addSeries(
        HistogramSeries,
        { priceFormat: { type: "volume" }, color: "#39424f", priceLineVisible: false },
        1,
      );
      volumeRef.current = volume;
      chart.panes()[1]?.setStretchFactor(0.25);
    }

    // Attached here for the same reason as the volume series: the primitive's
    // lifetime is the chart's. chart.remove() below tears it down, and nothing may
    // touch it afterwards.
    const adapter = scaleAdapterFor(chart, candles);
    const primitive = new DrawingsPrimitive({
      // Absolute bar index to pixel. The chart was handed data starting at
      // `from`, so its logical indices are offset by that — the same trap
      // mark-bars hit in M3.
      barToX: (bar) => {
        const { from: start, to: end } = windowRef.current;
        return barIndexToX(adapter, bar - start, {
          min: 0,
          max: Math.max(0, end - start - 1),
        });
      },
      priceToY: (price) => priceToY(adapter, price),
      range: () => windowRef.current,
    });
    candles.attachPrimitive(primitive);
    primitiveRef.current = primitive;

    chartRef.current = chart;
    candlesRef.current = candles;

    const resize = new ResizeObserver(([entry]) => {
      if (entry) chart.applyOptions({ width: entry.contentRect.width });
    });
    resize.observe(container);

    return () => {
      resize.disconnect();
      // Removes every series it owns; nothing else may touch them afterwards.
      chart.remove();
      chartRef.current = null;
      candlesRef.current = null;
      volumeRef.current = null;
      primitiveRef.current = null;
    };
  }, [height, showVolume]);

  // Pushed rather than pulled: setItems calls the library's requestUpdate, which
  // is how a primitive asks for a repaint. Writing a ref during render would work
  // but is disallowed under concurrent rendering.
  useEffect(() => {
    windowRef.current = { from, to };
    primitiveRef.current?.setItems(drawings ?? []);
  }, [drawings, from, to]);

  useEffect(() => {
    const chart = chartRef.current;
    const candles = candlesRef.current;
    if (!chart || !candles) return;

    candles.setData(toCandlestickData(series, { from, to }));
    volumeRef.current?.setData(toVolumeData(series, { from, to }));
    chart.timeScale().fitContent();
  }, [series, from, to]);

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
