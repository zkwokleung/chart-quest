"use client";

import { useState } from "react";
import { SliceChart } from "@/components/level/SliceChart";
import type { KindProps } from "@/lib/levels/kind-module";
import type { Direction } from "@/lib/levels/schema";
import { actualDirection } from "./grade";

/**
 * Round-based prediction: the chart stops, the player calls a direction, the next
 * bars appear.
 *
 * Deliberately minimal. Boss 1.B needs truncate, call, reveal and repeat — no
 * replay controls, no trade placement. The truncate-and-reveal core is the
 * foundation the full replay engine builds on rather than replaces.
 */
export function PredictNext({
  level,
  data,
  hintsUsed,
  grade,
  attempt,
  onCommit,
}: KindProps<"predict-next">) {
  const rounds = level.data;
  const [calls, setCalls] = useState<(Direction | null)[]>(() =>
    rounds.map(() => null),
  );
  const [round, setRound] = useState(0);

  const committed = grade !== null;
  const shown = committed ? (attempt?.calls ?? calls) : calls;
  const slice = rounds[round];
  const series = data[round];
  const called = shown[round] ?? null;
  const revealed = called !== null;

  const truth =
    revealed && slice
      ? actualDirection(series, slice.to - 1, level.config.horizon)
      : null;

  function call(direction: Direction) {
    if (committed || called !== null) return;
    setCalls((current) => current.map((c, i) => (i === round ? direction : c)));
  }

  const answered = shown.filter((c) => c !== null).length;
  const allAnswered = answered === rounds.length;

  if (!slice || !series) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-sm font-medium">{level.config.prompt}</p>
        <p className="font-mono text-xs text-muted">
          round {round + 1} of {rounds.length} · {answered} called
        </p>
      </div>

      <SliceChart
        slice={slice}
        series={series}
        // Only extend the window once the call is locked in. Revealing before
        // that would hand the player the answer.
        to={revealed ? slice.to + level.config.horizon : slice.to}
        height={360}
        showVolume={false}
      />

      {revealed ? (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span
            className={
              truth === called ? "font-medium text-up" : "font-medium text-down"
            }
          >
            {truth === called ? "✓ right" : "✗ wrong"}
          </span>
          <span className="text-muted">
            you called <strong>{called}</strong>, it went <strong>{truth}</strong>
          </span>
          {round < rounds.length - 1 ? (
            <button
              type="button"
              onClick={() => setRound((r) => r + 1)}
              className="rounded border border-border px-3 py-1.5 hover:border-accent focus-visible:outline-2 focus-visible:outline-accent"
            >
              Next round →
            </button>
          ) : null}
        </div>
      ) : (
        <div className="flex gap-3">
          {(["up", "down"] as const).map((direction) => (
            <button
              key={direction}
              type="button"
              onClick={() => call(direction)}
              className="rounded-md border border-border bg-surface px-6 py-2.5 font-medium hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {direction === "up" ? "↑ Up" : "↓ Down"}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-1.5" aria-hidden="true">
        {shown.map((c, i) => (
          <span
            key={i}
            className={[
              "h-1.5 w-8 rounded-full",
              c === null ? "bg-border" : i === round ? "bg-accent" : "bg-muted",
            ].join(" ")}
          />
        ))}
      </div>

      {committed || !allAnswered ? null : (
        <button
          type="button"
          onClick={() => onCommit({ kind: "predict-next", calls, hintsUsed })}
          className="self-start rounded-md bg-accent px-5 py-2.5 font-medium text-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          See how you did
        </button>
      )}
    </div>
  );
}
