"use client";

import { useState } from "react";
import { barAt } from "@/lib/chart/types";
import type { KindProps } from "@/lib/levels/kind-module";
import { CANDLE_PARTS, partLabel, partMark } from "@/lib/levels/mark";
import type { CandlePart, Mark } from "@/lib/levels/schema";

/**
 * One candle, magnified, with its parts as hit targets.
 *
 * Level 1.1 asks which part is which, and a chart at normal scale is far too
 * small to point at a wick. Rendered as SVG rather than through the charting
 * library so the hit zones are exact and each one can be a real button — which is
 * also what makes it keyboard-operable for free.
 */

const W = 260;
const H = 380;
const PAD = 40;
const BODY_W = 90;

export function CandleAnatomy({
  level,
  feeds,
  hintsUsed,
  grade,
  attempt,
  onCommit,
}: KindProps<"mark-bars">) {
  const [marks, setMarks] = useState<Mark[]>([]);
  const committed = grade !== null;
  const shown = committed ? (attempt?.marks ?? []) : marks;

  const slice = level.data[0];
  const series = feeds[0]?.visible();
  const focus = level.config.focusBar ?? slice?.from ?? 0;
  const bar = series ? barAt(series, focus) : null;

  const overlay = grade?.reference.kind === "marks" ? grade.reference : null;
  const asked = new Set(level.target.marks);

  function toggle(part: CandlePart) {
    if (committed) return;
    const mark = partMark(part);
    setMarks((current) =>
      current.includes(mark)
        ? current.filter((m) => m !== mark)
        : [...current, mark],
    );
  }

  if (!bar) return null;

  const bullish = bar.c >= bar.o;
  const scale = (price: number) =>
    H - PAD - ((price - bar.l) / Math.max(1e-9, bar.h - bar.l)) * (H - 2 * PAD);

  const yHigh = scale(bar.h);
  const yLow = scale(bar.l);
  const yTop = scale(Math.max(bar.o, bar.c));
  const yBottom = scale(Math.min(bar.o, bar.c));
  const yOpen = scale(bar.o);
  const yClose = scale(bar.c);
  const cx = W / 2;

  const ZONES: { part: CandlePart; y: number; h: number; label: string }[] = [
    {
      part: "upper-wick",
      y: yHigh,
      h: Math.max(8, yTop - yHigh),
      label: "upper wick",
    },
    { part: "body", y: yTop, h: Math.max(12, yBottom - yTop), label: "body" },
    {
      part: "lower-wick",
      y: yBottom,
      h: Math.max(8, yLow - yBottom),
      label: "lower wick",
    },
  ];

  function stateOf(part: CandlePart): "hit" | "wrong" | "chosen" | "idle" {
    const mark = partMark(part);
    if (!committed) return shown.includes(mark) ? "chosen" : "idle";
    if (overlay?.hit.includes(mark)) return "hit";
    if (overlay?.wrong.includes(mark)) return "wrong";
    return "idle";
  }

  const strokeFor = (part: CandlePart) => {
    const state = stateOf(part);
    if (state === "hit") return "var(--color-up)";
    if (state === "wrong") return "var(--color-down)";
    if (state === "chosen") return "var(--color-accent)";
    return "transparent";
  };

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm font-medium">{level.config.prompt}</p>

      <div className="flex flex-wrap items-start gap-8">
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`A ${bullish ? "bullish" : "bearish"} candle: open ${bar.o}, high ${bar.h}, low ${bar.l}, close ${bar.c}`}
          className="shrink-0 rounded-lg border border-border bg-surface"
        >
          <line
            x1={cx}
            y1={yHigh}
            x2={cx}
            y2={yLow}
            stroke={bullish ? "var(--color-up)" : "var(--color-down)"}
            strokeWidth={2}
          />
          <rect
            x={cx - BODY_W / 2}
            y={yTop}
            width={BODY_W}
            height={Math.max(2, yBottom - yTop)}
            // Hollow for a down candle, so direction survives colour-blindness.
            fill={bullish ? "var(--color-up)" : "transparent"}
            stroke={bullish ? "var(--color-up)" : "var(--color-down)"}
            strokeWidth={2}
          />

          {/* Open and close are the body's two edges; which edge depends on
              direction, which is a large part of what the level teaches. */}
          {(["open", "close"] as const).map((part) => {
            const y = part === "open" ? yOpen : yClose;
            return (
              <line
                key={part}
                x1={cx - BODY_W / 2 - 14}
                y1={y}
                x2={cx + BODY_W / 2 + 14}
                y2={y}
                stroke={strokeFor(part)}
                strokeWidth={3}
                strokeDasharray="4 3"
              />
            );
          })}

          {ZONES.map((zone) => (
            <rect
              key={zone.part}
              x={cx - BODY_W / 2 - 20}
              y={zone.y}
              width={BODY_W + 40}
              height={zone.h}
              fill="transparent"
              stroke={strokeFor(zone.part)}
              strokeWidth={2}
              strokeDasharray={stateOf(zone.part) === "idle" ? "0" : "6 3"}
            />
          ))}
        </svg>

        <fieldset className="flex flex-col gap-2" disabled={committed}>
          <legend className="mb-1 text-xs uppercase tracking-wide text-muted">
            Parts
          </legend>
          {/* After committing, keep both the answer and whatever the player chose.
              Showing only the answer would hide their mistake, which is the half
              of the feedback that teaches. */}
          {CANDLE_PARTS.filter(
            (p) =>
              !committed ||
              asked.has(partMark(p)) ||
              shown.includes(partMark(p)),
          ).map((part) => {
            const state = stateOf(part);
            return (
              <button
                key={part}
                type="button"
                onClick={() => toggle(part)}
                aria-pressed={shown.includes(partMark(part))}
                className={[
                  "rounded border px-3 py-2 text-left text-sm",
                  state === "hit"
                    ? "border-up text-up"
                    : state === "wrong"
                      ? "border-down text-down"
                      : state === "chosen"
                        ? "border-accent"
                        : "border-border hover:border-muted",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                ].join(" ")}
              >
                {state === "hit" ? "✓ " : state === "wrong" ? "✗ " : ""}
                {partLabel(part)}
              </button>
            );
          })}
        </fieldset>
      </div>

      {overlay && overlay.missed.length > 0 ? (
        <p className="text-xs text-muted">
          Missed: {overlay.missed.map((m) => m.replace("part:", "")).join(", ")}
        </p>
      ) : null}

      {committed ? null : (
        <button
          type="button"
          disabled={marks.length === 0}
          onClick={() => onCommit({ kind: "mark-bars", marks, hintsUsed })}
          className="self-start rounded-md bg-accent px-5 py-2.5 font-medium text-bg disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Commit answer
        </button>
      )}
    </div>
  );
}
