"use client";

import { useState } from "react";
import { AssetCharacterReadout } from "@/components/level/AssetCharacterReadout";
import { DrawdownReadout } from "@/components/level/DrawdownReadout";
import { EdgeSweepReadout } from "@/components/level/EdgeSweepReadout";
import type { KindProps } from "@/lib/levels/kind-module";
import { exploredFraction } from "./grade";

/**
 * A control over a measurement, rather than over an indicator.
 *
 * The interaction is `tune-param`'s and the readout is not: dragging recomputes a table across
 * six markets instead of redrawing a line on one chart. That is the whole reason this is its
 * own kind — `tune-param`'s config is `(value) => IndicatorSpec`, and there is no honest way to
 * make a variance ratio across the spine into an indicator on a window.
 *
 * A native `<input type="range">`, as `ReplayControls` and `TuneParam` use, so it is keyboard
 * operable without anything being written for it.
 *
 * **The commit button stays disabled until the player has swept.** Issue #26 asks that 8.2's
 * player run the probe rather than read a conclusion, and the grader already caps accuracy by
 * exploration — but a button that simply refuses is clearer than a score explained afterwards,
 * and it makes the requirement part of the interaction instead of a surprise in the correction.
 */
export function Probe({
  level,
  hintsUsed,
  grade,
  attempt,
  onCommit,
}: KindProps<"probe">) {
  const {
    prompt,
    label,
    min,
    max,
    step,
    initial,
    assets,
    focus,
    exploreFraction,
    measure,
    revealOnCommit,
  } = level.config;

  const [value, setValue] = useState(initial);
  const [visited, setVisited] = useState<number[]>([initial]);

  const committed = grade !== null;
  const shown = committed ? (attempt?.value ?? value) : value;
  const seen = committed ? (attempt?.visited ?? visited) : visited;

  const explored = exploredFraction(
    { kind: "probe", value: shown, visited: seen, hintsUsed },
    level,
  );
  const required = exploreFraction ?? 0.6;
  const swept = explored >= required;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-medium">{prompt}</p>

      {/* One readout per measurement, switched here rather than by the level. The switch is
          exhaustive, so a new `measure` without a readout is a compile error — and it lives
          inside the lazy `probe` chunk, so no other route pays for any of them. */}
      {measure === "variance-ratio" ? (
        <AssetCharacterReadout
          assets={assets}
          focus={focus}
          horizon={shown}
          label={label}
        />
      ) : measure === "edge-sweep" ? (
        <EdgeSweepReadout
          lookback={shown}
          revealed={revealOnCommit !== true || committed}
        />
      ) : (
        <DrawdownReadout
          guess={shown}
          revealed={revealOnCommit !== true || committed}
        />
      )}

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3">
        <label className="flex items-center gap-3 text-sm">
          <span className="w-28 shrink-0 font-mono text-xs text-muted">{label}</span>
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
              // Every resting position, so the sweep can be scored rather than the landing.
              setVisited((current) =>
                current.includes(next) ? current : [...current, next],
              );
            }}
            className="w-full accent-[var(--color-accent)] disabled:opacity-60"
          />
          <output className="w-10 shrink-0 text-right font-mono text-sm">{shown}</output>
        </label>

        {committed ? null : (
          <>
            <p className="font-mono text-xs text-muted" aria-live="polite">
              explored {Math.round(explored * 100)}% of the range
              {swept ? "" : " · move it further to answer"}
            </p>
            <button
              type="button"
              disabled={!swept}
              onClick={() =>
                onCommit({ kind: "probe", value: shown, visited: seen, hintsUsed })
              }
              className="self-start rounded-md bg-accent px-5 py-2.5 font-medium text-bg disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Commit {shown}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
