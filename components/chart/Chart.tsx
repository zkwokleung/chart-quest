"use client";

import {
  CandlestickSeries,
  createChart,
  HistogramSeries,
  LineSeries,
  PriceScaleMode,
  type IChartApi,
  type ISeriesApi,
  type Logical,
  type UTCTimestamp,
} from "lightweight-charts";
import {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type Ref,
} from "react";
import type { LogicalBounds, ScaleAdapter } from "@/lib/chart/coords";
import { barIndexToX, priceToY } from "@/lib/chart/coords";
import {
  computeIndicator,
  indicatorLayoutKey,
  indicatorShape,
  type IndicatorSpec,
} from "@/lib/chart/indicator-data";
import {
  clampRange,
  toCandlestickData,
  toCloseLineData,
  toLineData,
  toVolumeData,
} from "@/lib/chart/to-lwc";
import { RENDER_AS_LINE } from "@/lib/chart/types";
import type { BarRange, Series, SeriesId } from "@/lib/chart/types";
import { formatMode, toMode, type YAxisMode } from "@/lib/ta/normalize";
import { ChartData } from "./ChartData";
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
  /**
   * Indicators to draw. Overlays share the price pane; oscillators take their own.
   *
   * Changing a *parameter* re-pushes data; changing the *set* rebuilds the chart.
   * That split is what lets a tune-param slider redraw a moving average as fast as
   * it is dragged without tearing down and recreating the whole chart each frame.
   */
  indicators?: readonly IndicatorSpec[];
  /**
   * What the y-axis measures. Presentation only — see the effect that applies it.
   */
  yAxisMode?: YAxisMode;
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
/**
 * The price series, whichever shape it is drawn in.
 *
 * Everything below needs only `coordinateToPrice`, `priceToCoordinate`, `setData`,
 * `attachPrimitive` and `priceScale`, all of which both series types have — so drawing a
 * series as a line costs a union here rather than a second code path.
 */
type PriceSeries = ISeriesApi<"Candlestick"> | ISeriesApi<"Line">;

function scaleAdapterFor(chart: IChartApi, series: PriceSeries): ScaleAdapter {
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
  indicators,
  yAxisMode = "price",
  ref,
}: ChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlesRef = useRef<PriceSeries | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  const { from, to } = clampRange(series, range);

  // One entry per indicator, each holding that indicator's line series in the
  // order computeIndicator returned them, plus an optional histogram.
  const indicatorRef = useRef<
    { lines: ISeriesApi<"Line">[]; histogram?: ISeriesApi<"Histogram"> }[]
  >([]);

  const specs = useMemo(() => indicators ?? [], [indicators]);
  const layoutKey = indicatorLayoutKey(specs);

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
          chartRef.current
            ?.timeScale()
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
    //
    // A few series are drawn as a line because their candle bodies would be fiction — see
    // `RENDER_AS_LINE`. The decision is the data's, not the level's, so it is read from the
    // series id here rather than passed in: a level cannot ask for an honest series to be
    // flattened, and cannot forget to ask for a dishonest one to be.
    const asLine = RENDER_AS_LINE.has(series.id as SeriesId);
    const candles: PriceSeries = asLine
      ? chart.addSeries(LineSeries, {
          color: CANDLE_UP,
          lineWidth: 2,
          priceLineVisible: false,
        })
      : chart.addSeries(CandlestickSeries, {
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
        {
          priceFormat: { type: "volume" },
          color: "#39424f",
          priceLineVisible: false,
        },
        1,
      );
      volumeRef.current = volume;
      chart.panes()[1]?.setStretchFactor(0.25);
    }

    // Indicator series, created here for the same reason as volume: their lifetime
    // is the chart's. Oscillators take panes after volume's, one each, so an RSI and
    // a MACD on the same level do not fight over one scale.
    let nextPane = showVolume ? 2 : 1;
    indicatorRef.current = specs.map((spec, index) => {
      const shape = indicatorShape(spec, index);
      const pane = shape.overlay ? 0 : nextPane;
      if (!shape.overlay) nextPane += 1;

      const lines = shape.lines.map((line) =>
        chart.addSeries(
          LineSeries,
          {
            color: line.color,
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false,
            title: line.label,
          },
          pane,
        ),
      );

      const histogram = shape.histogram
        ? chart.addSeries(
            HistogramSeries,
            {
              color: "#39424f",
              priceLineVisible: false,
              lastValueVisible: false,
            },
            pane,
          )
        : undefined;

      // Reference lines belong to the pane rather than to a series, but the library
      // hangs them off one — so the first line carries them.
      for (const guide of shape.guides) {
        lines[0]?.createPriceLine({
          price: guide,
          color: "#2a3140",
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: "",
        });
      }

      if (pane > 0) chart.panes()[pane]?.setStretchFactor(0.3);
      return histogram ? { lines, histogram } : { lines };
    });

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
      indicatorRef.current = [];
    };
    // `layoutKey` rather than `specs`: the chart is rebuilt when the *set* of
    // indicators changes, not when one of their parameters does. Creating the
    // series needs only `indicatorShape`, which is why nothing here touches the
    // data — a tune-param slider re-pushes values without rebuilding anything.
  }, [height, showVolume, layoutKey, specs]);

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

    if (RENDER_AS_LINE.has(series.id as SeriesId)) {
      (candles as ISeriesApi<"Line">).setData(toCloseLineData(series, { from, to }));
    } else {
      (candles as ISeriesApi<"Candlestick">).setData(
        toCandlestickData(series, { from, to }),
      );
    }
    volumeRef.current?.setData(toVolumeData(series, { from, to }));

    // Indicator values come from the same `series` the candles do — which on a
    // replay level is `feed.visible()`, so an average cannot include bars the
    // player has not been shown. The seal covers derived data because the data is
    // derived from the sealed thing, not alongside it.
    specs.forEach((spec, i) => {
      const target = indicatorRef.current[i];
      if (!target) return;
      const render = computeIndicator(spec, series, i);
      render.lines.forEach((line, k) => {
        target.lines[k]?.setData(toLineData(series, line.values, { from, to }));
      });
      if (render.histogram && target.histogram) {
        target.histogram.setData(
          toLineData(series, render.histogram, { from, to }).map((point) => ({
            time: point.time,
            value: point.value,
            color: point.value >= 0 ? "#2f6f5a" : "#7a3a2a",
          })),
        );
      }
    });

    chart.timeScale().fitContent();
  }, [series, from, to, specs]);

  /**
   * The y-axis mode, applied as a *label formatter* and nothing else.
   *
   * This is what makes "normalization never changes grading" structural rather than
   * a convention anyone has to remember. The series keeps raw prices, so drawings,
   * hit-testing, the pane primitive and every grader carry on in the units they
   * were written for; only the axis labels are rewritten.
   *
   * It is also exact rather than approximate. Percent-from-anchor and ATR-multiples
   * are both affine in price — subtract a fixed anchor, divide by a fixed unit — so
   * a linear axis relabelled by an affine function is still a correct axis. A
   * transform that were not affine could not be done this way and would have to
   * move the data, which is precisely where a grading discrepancy would creep in.
   */
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    // On the price series rather than `chart.localization`, which is chart-wide and therefore
    // relabels *every* pane — including volume. 8.B showed a volume axis reading
    // "+1036269330.1%" because a share count had been run through percent-from-anchor. The
    // formatter belongs to the series whose numbers are prices.
    candlesRef.current?.applyOptions({
      priceFormat: {
        type: "custom",
        minMove: 0.00001,
        formatter: (price: number) => {
          const converted = toMode(price, yAxisMode, series, from);
          return converted === null
            ? price.toFixed(2)
            : formatMode(converted, yAxisMode);
        },
      },
    });
  }, [yAxisMode, series, from]);

  useEffect(() => {
    candlesRef.current?.priceScale().applyOptions({
      mode:
        priceScale === "logarithmic"
          ? PriceScaleMode.Logarithmic
          : PriceScaleMode.Normal,
    });
  }, [priceScale]);

  return (
    // Two elements rather than one, and the inner is hidden from assistive technology.
    //
    // `lightweight-charts` lays itself out in a `<table>`, and that table lands inside whatever
    // element it is handed. `role="img"` is supposed to make a node a leaf, and Chrome exposes the
    // descendants anyway — so a screen reader met the chart's label and then a table of empty cells,
    // on every charted level in the game. `aria-hidden` on the container the library owns is what
    // actually removes it, and the label stays on the wrapper where it still applies.
    //
    // The wrapper keeps `className` because that is where the sizing lives; the inner fills it, which
    // is what the library's ResizeObserver measures.
    <>
      <div
        className={className}
        role="img"
        aria-label={`Price chart, ${series.id}, ${to - from} bars`}
      >
        <div ref={containerRef} aria-hidden="true" className="h-full w-full" />
      </div>
      {/* Outside the `role="img"` wrapper, or it would be inside a node assistive technology treats as
          a leaf — which is the same mistake the layout table made. A sibling is reachable. */}
      <ChartData series={series} from={from} to={to} />
    </>
  );
}

export type { UTCTimestamp };
