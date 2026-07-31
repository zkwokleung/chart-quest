import { bollingerSeries } from "@/lib/ta/bollinger";
import { macdSeries, type MacdParams } from "@/lib/ta/macd";
import { emaSeries, smaSeries } from "@/lib/ta/moving-average";
import { rsiSeries } from "@/lib/ta/rsi";
import type { Series } from "./types";

/**
 * What a level asks to see on its chart, and what that turns into.
 *
 * Splitting the computation from the rendering keeps the whole of it testable
 * without a chart, and keeps `Chart.tsx` from knowing what an RSI is. The chart's
 * job is "draw these lines in these panes"; which lines is decided here.
 */

export type IndicatorSpec =
  | { kind: "sma"; period: number }
  | { kind: "ema"; period: number }
  | { kind: "bollinger"; period: number; deviations?: number }
  | { kind: "rsi"; period: number }
  | { kind: "macd"; params?: MacdParams };

export type IndicatorLine = {
  /** Stable within one spec, so the chart can key its series. */
  key: string;
  label: string;
  color: string;
  /** One entry per bar of the series handed in; `null` where undefined. */
  values: (number | null)[];
};

/**
 * What an indicator looks like, without computing it.
 *
 * The chart needs this to create its series, and it must not need the data to do
 * so: the series are created once with the chart's lifetime, while the values are
 * pushed on every reveal. Computing an RSI to find out that it has one line and its
 * own pane would do the arithmetic twice on mount and force the lifetime effect to
 * depend on the series it is trying not to depend on.
 */
export type IndicatorShape = {
  /** True to draw on the price pane, false to take a pane of its own. */
  overlay: boolean;
  lines: { key: string; label: string; color: string }[];
  histogram: boolean;
  /** Horizontal reference lines, in the pane's own units. */
  guides: number[];
};

export type IndicatorRender = Omit<IndicatorShape, "lines" | "histogram"> & {
  lines: IndicatorLine[];
  /** MACD's histogram values, or false for indicators that have none. */
  histogram: false | (number | null)[];
};

const OVERLAY_COLORS = ["#5ec8d8", "#c9a227", "#a78bfa"];
const BAND_COLOR = "#6b7684";
const MACD_COLOR = "#5ec8d8";
const SIGNAL_COLOR = "#e2603f";

/**
 * A label a player can match to what they see.
 *
 * The period is in the name deliberately: 5.1 and 5.2 are entirely about which
 * period is being looked at, and a legend reading "MA" would make the level
 * unplayable.
 */
export function indicatorLabel(spec: IndicatorSpec): string {
  switch (spec.kind) {
    case "sma":
      return `SMA ${spec.period}`;
    case "ema":
      return `EMA ${spec.period}`;
    case "bollinger":
      return `Bollinger ${spec.period}, ${spec.deviations ?? 2}σ`;
    case "rsi":
      return `RSI ${spec.period}`;
    case "macd": {
      const p = spec.params;
      return p ? `MACD ${p.fast},${p.slow},${p.signal}` : "MACD 12,26,9";
    }
  }
}

/** What series to create, and how to label them, without touching the data. */
export function indicatorShape(
  spec: IndicatorSpec,
  colorIndex = 0,
): IndicatorShape {
  const accent =
    OVERLAY_COLORS[colorIndex % OVERLAY_COLORS.length] ?? "#5ec8d8";
  const label = indicatorLabel(spec);

  switch (spec.kind) {
    case "sma":
    case "ema":
      return {
        overlay: true,
        lines: [{ key: spec.kind, label, color: accent }],
        histogram: false,
        guides: [],
      };

    case "bollinger":
      return {
        overlay: true,
        lines: [
          { key: "upper", label: `${label} upper`, color: BAND_COLOR },
          { key: "middle", label: `${label} middle`, color: accent },
          { key: "lower", label: `${label} lower`, color: BAND_COLOR },
        ],
        histogram: false,
        guides: [],
      };

    case "rsi":
      return {
        overlay: false,
        lines: [{ key: "rsi", label, color: accent }],
        histogram: false,
        // 30 and 70 rather than 20/80: the conventional levels, so 5.3's point —
        // price rising for weeks with RSI pinned above the upper one — lands
        // against the line the player has seen everywhere else.
        guides: [30, 70],
      };

    case "macd":
      return {
        overlay: false,
        lines: [
          { key: "macd", label: "MACD", color: MACD_COLOR },
          { key: "signal", label: "signal", color: SIGNAL_COLOR },
        ],
        histogram: true,
        guides: [0],
      };
  }
}

/** The shape, with each line's values filled in from the series. */
export function computeIndicator(
  spec: IndicatorSpec,
  series: Series<string>,
  colorIndex = 0,
): IndicatorRender {
  const shape = indicatorShape(spec, colorIndex);
  const values = indicatorValues(spec, series);
  return {
    ...shape,
    lines: shape.lines.map((line, i) => ({
      ...line,
      values: values.lines[i] ?? [],
    })),
    histogram: values.histogram ?? false,
  };
}

/** Just the numbers, in the order `indicatorShape` declares its lines. */
function indicatorValues(
  spec: IndicatorSpec,
  series: Series<string>,
): { lines: (number | null)[][]; histogram?: (number | null)[] } {
  switch (spec.kind) {
    case "sma":
      return { lines: [smaSeries(series, spec.period)] };
    case "ema":
      return { lines: [emaSeries(series, spec.period)] };
    case "bollinger": {
      const points = bollingerSeries(series, spec.period, spec.deviations ?? 2);
      return {
        lines: [
          points.map((p) => p?.upper ?? null),
          points.map((p) => p?.middle ?? null),
          points.map((p) => p?.lower ?? null),
        ],
      };
    }
    case "rsi":
      return { lines: [rsiSeries(series, spec.period)] };
    case "macd": {
      const points = macdSeries(series, spec.params);
      return {
        lines: [
          points.map((p) => p?.macd ?? null),
          points.map((p) => p?.signal ?? null),
        ],
        histogram: points.map((p) => p?.histogram ?? null),
      };
    }
  }
}

/**
 * A key describing the *shape* of an indicator set — how many series, in how many
 * panes — without its parameters.
 *
 * The chart recreates its series when this changes and only re-pushes data when it
 * does not. That is what lets a `tune-param` slider redraw a moving average sixty
 * times a second without tearing the chart down and rebuilding it each time.
 */
export function indicatorLayoutKey(specs: readonly IndicatorSpec[]): string {
  return specs.map((spec) => spec.kind).join("|");
}
