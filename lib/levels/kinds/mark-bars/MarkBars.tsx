"use client";

import { useRef, useState } from "react";
import type { ChartHandle } from "@/components/chart/Chart";
import { FeedChart } from "@/components/level/FeedChart";
import { xToBarIndex } from "@/lib/chart/coords";
import { barAt, type Series } from "@/lib/chart/types";
import type { KindProps } from "@/lib/levels/kind-module";
import { barIndexOf, barMark } from "@/lib/levels/mark";
import type { Mark } from "@/lib/levels/schema";
import { CandleAnatomy } from "./CandleAnatomy";

export function MarkBars(props: KindProps<"mark-bars">) {
  // The anatomy mode magnifies a single candle rather than rendering a chart, so
  // it is a different view over the same click-and-grade machinery.
  return props.level.config.mode === "candle-anatomy" ? (
    <CandleAnatomy {...props} />
  ) : (
    <MarkBarsOnChart {...props} />
  );
}

function describeBar(series: Series<string>, index: number): string {
  const bar = barAt(series, index);
  if (!bar) return `bar ${index}`;
  return `bar ${index}, ${new Date(bar.t).toISOString().slice(0, 10)}, close ${bar.c}`;
}

function MarkBarsOnChart({
  level,
  feeds,
  hintsUsed,
  grade,
  attempt,
  onCommit,
}: KindProps<"mark-bars">) {
  const handleRef = useRef<ChartHandle | null>(null);
  const [marks, setMarks] = useState<Mark[]>([]);
  const slice = level.data[0];
  const feed = feeds[0];
  const series = feed?.visible();
  const [cursor, setCursor] = useState(slice?.from ?? 0);

  const committed = grade !== null;
  const shown = committed ? (attempt?.marks ?? []) : marks;
  const expected = level.config.expected ?? level.target.marks.length;
  const overlay = grade?.reference.kind === "marks" ? grade.reference : null;

  function toggle(absoluteIndex: number) {
    if (committed) return;
    const mark = barMark(absoluteIndex);
    setMarks((current) =>
      current.includes(mark)
        ? current.filter((m) => m !== mark)
        : [...current, mark],
    );
  }

  function onClick(event: React.MouseEvent<HTMLDivElement>) {
    const handle = handleRef.current;
    if (committed || !handle || !slice) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const logical = xToBarIndex(
      handle.scale,
      event.clientX - rect.left,
      handle.bounds,
    );
    if (logical === null) return;
    // `bounds` is relative to the data handed to the chart, which starts at
    // `slice.from`. Levels author absolute indices, so translate before marking —
    // otherwise every mark is off by the slice offset.
    const absolute = slice.from + logical;
    setCursor(absolute);
    toggle(absolute);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (committed || !slice) return;
    const step = event.shiftKey ? 10 : 1;
    const last = slice.to - 1;

    switch (event.key) {
      case "ArrowRight":
        event.preventDefault();
        setCursor((c) => Math.min(last, c + step));
        break;
      case "ArrowLeft":
        event.preventDefault();
        setCursor((c) => Math.max(slice.from, c - step));
        break;
      case "Home":
        event.preventDefault();
        setCursor(slice.from);
        break;
      case "End":
        event.preventDefault();
        setCursor(last);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        toggle(cursor);
        break;
      default:
        break;
    }
  }

  if (!slice || !series || !feed) return null;

  const cursorMarked = shown.includes(barMark(cursor));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-medium">{level.config.prompt}</p>

      <div
        role="application"
        tabIndex={committed ? -1 : 0}
        aria-label={`${level.config.prompt} Use arrow keys to move between bars, shift for ten at a time, enter to mark.`}
        onClick={onClick}
        onKeyDown={onKeyDown}
        className="cursor-crosshair rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <FeedChart
          slice={slice}
          feed={feed}
          ref={handleRef}
          height={360}
          yAxis={level.yAxis}
        />
      </div>

      {/* The keyboard cursor's position, announced rather than only drawn, so the
          chart is operable and legible without a pointer. */}
      <p className="font-mono text-xs text-muted" aria-live="polite">
        {committed
          ? `${shown.length} marked`
          : `cursor: ${describeBar(series, cursor)}${cursorMarked ? " · marked" : ""}`}
      </p>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted">
          Marked {shown.length} of {expected}
        </span>
        {shown.map((mark) => {
          const index = barIndexOf(mark);
          const state = overlay
            ? overlay.hit.includes(mark)
              ? "hit"
              : "wrong"
            : "pending";
          return (
            <button
              key={mark}
              type="button"
              disabled={committed}
              onClick={() => setMarks((c) => c.filter((m) => m !== mark))}
              aria-label={
                committed
                  ? `${state === "hit" ? "Correct" : "Incorrect"}: bar ${index}`
                  : `Remove mark on bar ${index}`
              }
              className={[
                "rounded border px-2 py-1 font-mono",
                state === "hit"
                  ? "border-up text-up"
                  : state === "wrong"
                    ? "border-down text-down line-through"
                    : "border-border hover:border-down",
              ].join(" ")}
            >
              {state === "hit" ? "✓ " : state === "wrong" ? "✗ " : ""}bar{" "}
              {index}
            </button>
          );
        })}
      </div>

      {overlay && overlay.missed.length > 0 ? (
        <p className="text-xs text-muted">
          Missed:{" "}
          <span className="font-mono">
            {overlay.missed.map((m) => `bar ${barIndexOf(m)}`).join(", ")}
          </span>
        </p>
      ) : null}

      {committed ? null : (
        <button
          type="button"
          disabled={marks.length === 0}
          onClick={() => onCommit({ kind: "mark-bars", marks, hintsUsed })}
          className="self-start rounded-md bg-accent px-5 py-2.5 font-medium text-bg disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Commit {marks.length} mark{marks.length === 1 ? "" : "s"}
        </button>
      )}
    </div>
  );
}
