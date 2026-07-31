"use client";

import { useState } from "react";
import { FeedChart } from "@/components/level/FeedChart";
import type { KindProps } from "@/lib/levels/kind-module";
import { exploredFraction } from "./grade";

/**
 * A slider that redraws an indicator live.
 *
 * The whole point is the redraw: 5.1 teaches lag by letting the player watch a
 * moving average detach from price as the period grows, which no amount of prose
 * conveys. `indicatorLayoutKey` is what makes that affordable — dragging changes a
 * parameter, not the set of indicators, so the chart re-pushes values rather than
 * rebuilding its series each frame.
 *
 * A native `<input type="range">`, as `ReplayControls` uses. It is keyboard
 * operable for free, which is the whole accessibility requirement here.
 */
export function TuneParam({
  level,
  feeds,
  hintsUsed,
  grade,
  attempt,
  onCommit,
}: KindProps<"tune-param">) {
  const { prompt, label, min, max, step, initial, indicator } = level.config;
  const slice = level.data[0];
  const feed = feeds[0];

  const [value, setValue] = useState(initial);
  // Every resting position, so an exploration level can score whether the player
  // actually looked rather than whether they happened to stop somewhere good.
  const [visited, setVisited] = useState<number[]>([initial]);

  const committed = grade !== null;
  const shown = committed ? (attempt?.value ?? value) : value;

  if (!slice || !feed) return null;

  const explored = exploredFraction(
    { kind: "tune-param", value: shown, visited, hintsUsed },
    level,
  );
  const wantsExploration = level.config.scoring === "exploration";
  const required = level.config.exploreFraction ?? 0.6;
  const ready = !wantsExploration || explored >= required;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-medium">{prompt}</p>

      <FeedChart
        slice={slice}
        feed={feed}
        height={380}
        showVolume={false}
        indicators={[indicator(shown)]}
        yAxis={level.yAxis}
      />

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3">
        <label className="flex items-center gap-3 text-sm">
          <span className="w-28 shrink-0 font-mono text-xs text-muted">
            {label}
          </span>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={shown}
            disabled={committed}
            onChange={(event) => {
              const next = Number(event.target.value);
              setValue(next);
              setVisited((seen) =>
                seen.includes(next) ? seen : [...seen, next],
              );
            }}
            className="w-full accent-[var(--color-accent)]"
          />
          <span className="w-12 shrink-0 text-right font-mono text-sm">
            {shown}
          </span>
        </label>

        {committed ? null : (
          <>
            {wantsExploration ? (
              <p className="font-mono text-xs text-muted" aria-live="polite">
                explored {Math.round(explored * 100)}% of the range
                {ready ? "" : ` · move it further to answer`}
              </p>
            ) : null}
            <button
              type="button"
              disabled={!ready}
              onClick={() =>
                onCommit({
                  kind: "tune-param",
                  value: shown,
                  visited,
                  hintsUsed,
                })
              }
              className="self-start rounded-md bg-accent px-5 py-2.5 font-medium text-bg disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {wantsExploration ? "I have seen enough" : "Commit"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
