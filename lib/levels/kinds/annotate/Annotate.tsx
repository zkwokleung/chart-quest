"use client";

import { useRef, useState } from "react";
import type { ChartHandle } from "@/components/chart/Chart";
import type { RenderableDrawing } from "@/components/chart/DrawingPrimitive";
import { SliceChart } from "@/components/level/SliceChart";
import { xToBarIndex, yToPrice } from "@/lib/chart/coords";
import type { Anchor, Drawing } from "@/lib/chart/geometry";
import { barAt, type Series } from "@/lib/chart/types";
import type { KindProps } from "@/lib/levels/kind-module";

/**
 * Draw a shape on the chart.
 *
 * Two ways in, because one of them has to work without a pointer: click or drag to
 * place anchors, or move a keyboard cursor with the arrow keys and place with
 * enter. The cursor's bar, date and price are announced in a live region — the
 * pattern that made `mark-bars` genuinely operable by keyboard rather than
 * nominally so.
 */
export function Annotate({
  level,
  data,
  hintsUsed,
  grade,
  attempt,
  onCommit,
}: KindProps<"annotate">) {
  const handleRef = useRef<ChartHandle | null>(null);
  const slice = level.data[0];
  const series = data[0];

  const [anchors, setAnchors] = useState<Anchor[]>([]);
  const [cursor, setCursor] = useState<Anchor>(() => ({
    bar: slice?.from ?? 0,
    price: series && slice ? (barAt(series, slice.from)?.l ?? 0) : 0,
  }));

  const committed = grade !== null;
  const { shape } = level.config;

  const drawing = committed ? (attempt?.drawing ?? null) : buildDrawing(shape, anchors);

  function place(anchor: Anchor) {
    if (committed) return;
    setAnchors((current) => (current.length >= 2 ? [anchor] : [...current, anchor]));
  }

  function pointerAnchor(event: React.PointerEvent<HTMLDivElement>): Anchor | null {
    const handle = handleRef.current;
    if (!handle || !slice) return null;
    const rect = event.currentTarget.getBoundingClientRect();
    const logical = xToBarIndex(handle.scale, event.clientX - rect.left, handle.bounds);
    const price = yToPrice(handle.scale, event.clientY - rect.top);
    if (logical === null || price === null) return null;
    // Bounds are relative to the data the chart was handed, which starts at
    // `slice.from`; levels author absolute indices.
    return { bar: slice.from + logical, price };
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (committed || !slice || !series) return;
    const step = event.shiftKey ? 10 : 1;
    const last = slice.to - 1;

    // Snap the cursor's price to the bar's extreme as it moves, so a keyboard user
    // lands on wicks without having to nudge a price axis by hand.
    const priceAt = (bar: number) => {
      const b = barAt(series, bar);
      if (!b) return cursor.price;
      return level.config.side === "resistance" ? b.h : b.l;
    };

    switch (event.key) {
      case "ArrowRight": {
        event.preventDefault();
        const bar = Math.min(last, cursor.bar + step);
        setCursor({ bar, price: priceAt(bar) });
        break;
      }
      case "ArrowLeft": {
        event.preventDefault();
        const bar = Math.max(slice.from, cursor.bar - step);
        setCursor({ bar, price: priceAt(bar) });
        break;
      }
      case "ArrowUp":
      case "ArrowDown": {
        // Fine price control, for a level whose answer is not on an extreme.
        event.preventDefault();
        const span = (barAt(series, cursor.bar)?.h ?? 1) - (barAt(series, cursor.bar)?.l ?? 0);
        const nudge = (span || cursor.price * 0.01) * 0.15 * (event.key === "ArrowUp" ? 1 : -1);
        setCursor((c) => ({ ...c, price: c.price + nudge }));
        break;
      }
      case "Enter":
      case " ":
        event.preventDefault();
        place(cursor);
        break;
      case "Escape":
        event.preventDefault();
        setAnchors([]);
        break;
      default:
        break;
    }
  }

  if (!slice || !series) return null;

  const overlay = grade?.reference.kind === "drawing" ? grade.reference : null;
  const drawings: RenderableDrawing[] = [];
  if (drawing) drawings.push({ drawing, role: committed ? "hit" : "attempt" });
  if (overlay) drawings.push({ drawing: overlay.reference, role: "reference" });

  const needed = shape === "zone" || shape === "level" ? 2 : 2;
  const ready = anchors.length >= needed;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-medium">{level.config.prompt}</p>

      <div
        role="application"
        tabIndex={committed ? -1 : 0}
        aria-label={`${level.config.prompt} Arrow keys move the cursor, shift for ten bars, up and down adjust the price, enter places a point, escape clears.`}
        onPointerDown={(e) => {
          const anchor = pointerAnchor(e);
          if (anchor) {
            setCursor(anchor);
            place(anchor);
          }
        }}
        onKeyDown={onKeyDown}
        className="cursor-crosshair rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <SliceChart
          slice={slice}
          series={series}
          ref={handleRef}
          height={380}
          showVolume={false}
          drawings={drawings}
        />
      </div>

      <p className="font-mono text-xs text-muted" aria-live="polite">
        {committed
          ? describeGrade(overlay)
          : `${anchors.length} of ${needed} points · cursor ${describe(series, cursor)}`}
      </p>

      {committed ? null : (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={!ready}
            onClick={() =>
              onCommit({
                kind: "annotate",
                drawing: buildDrawing(shape, anchors),
                hintsUsed,
              })
            }
            className="rounded-md bg-accent px-5 py-2.5 font-medium text-bg disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Commit drawing
          </button>
          {anchors.length > 0 ? (
            <button
              type="button"
              onClick={() => setAnchors([])}
              className="rounded border border-border px-4 py-2 text-sm hover:border-accent focus-visible:outline-2 focus-visible:outline-accent"
            >
              Clear
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

function describe(series: Series<string>, anchor: Anchor): string {
  const bar = barAt(series, anchor.bar);
  const date = bar ? new Date(bar.t).toISOString().slice(0, 10) : "?";
  return `bar ${anchor.bar}, ${date}, ${anchor.price.toFixed(2)}`;
}

function describeGrade(overlay: { touched: number[]; cuts: number[] } | null): string {
  if (!overlay) return "";
  return `${overlay.touched.length} touches · ${overlay.cuts.length} body cuts · dashed line is one correct answer`;
}

/**
 * Two anchors become whichever shape the level asked for.
 *
 * A zone and a level care only about price, so they read it off the anchors and
 * ignore the bars — which lets one interaction serve all four shapes.
 */
function buildDrawing(shape: Drawing["shape"], anchors: Anchor[]): Drawing | null {
  const [a, b] = anchors;
  if (!a) return null;

  if (shape === "level") return { shape: "level", price: a.price };
  if (!b) return null;

  switch (shape) {
    case "trendline":
      return a.bar <= b.bar
        ? { shape: "trendline", a, b }
        : { shape: "trendline", a: b, b: a };
    case "zone":
      return {
        shape: "zone",
        top: Math.max(a.price, b.price),
        bottom: Math.min(a.price, b.price),
      };
    case "channel":
      return a.bar <= b.bar
        ? { shape: "channel", a, b, offset: 0 }
        : { shape: "channel", a: b, b: a, offset: 0 };
  }
}
