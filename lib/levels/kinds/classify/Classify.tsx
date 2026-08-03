"use client";

import { useEffect, useState } from "react";
import { yAxisFor } from "@/lib/levels/y-axis";
import { FeedChart } from "@/components/level/FeedChart";
import type { KindProps } from "@/lib/levels/kind-module";

/**
 * A question grounded in a chart, never in prose.
 *
 * One commit: answering reveals the grade, the diagnosis and the correct option.
 * Unlimited immediate retry would let a player brute-force a three-option
 * question in three clicks and learn nothing, so replaying the level is a fresh
 * start rather than another guess.
 */
export function Classify({
  level,
  feeds,
  hintsUsed,
  grade,
  attempt,
  onCommit,
}: KindProps<"classify">) {
  const [selected, setSelected] = useState<string[]>([]);
  const committed = grade !== null;
  const { options, multiple, prompt, revealBars } = level.config;

  // Committing reveals the next bars on every chart. The feed is the reveal: the
  // bars simply were not in `visible()` before, rather than being present and
  // cropped out of the render.
  useEffect(() => {
    if (!committed || !revealBars) return;
    for (const feed of feeds) feed.step(revealBars);
  }, [committed, revealBars, feeds]);

  const chosen = committed ? (attempt?.selected ?? []) : selected;
  const correct = new Set(level.target.correct);

  function toggle(id: string) {
    if (committed) return;
    setSelected((current) =>
      multiple
        ? current.includes(id)
          ? current.filter((x) => x !== id)
          : [...current, id]
        : [id],
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 lg:grid-cols-2">
        {level.data.map((slice, i) => {
          const feed = feeds[i];
          if (!feed) return null;
          return (
            <FeedChart
              key={`${slice.series}-${slice.from}`}
              slice={slice}
              feed={feed}
              height={level.data.length > 1 ? 260 : 360}
              scaleToggle={level.unlocks?.includes("log-scale") ?? false}
              yAxis={yAxisFor(level)}
            />
          );
        })}
      </div>

      <fieldset className="flex flex-col gap-2" disabled={committed}>
        <legend className="mb-2 text-sm font-medium">{prompt}</legend>
        {options.map((option) => {
          const isChosen = chosen.includes(option.id);
          const isCorrect = correct.has(option.id);
          return (
            <label
              key={option.id}
              className={[
                "flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors",
                committed && isCorrect
                  ? "border-up bg-up/10"
                  : committed && isChosen
                    ? "border-down bg-down/10"
                    : isChosen
                      ? "border-accent bg-accent/10"
                      : "border-border bg-surface hover:border-muted",
                committed ? "cursor-default" : "",
              ].join(" ")}
            >
              <input
                type={multiple ? "checkbox" : "radio"}
                name={`level-${level.id}`}
                value={option.id}
                checked={isChosen}
                onChange={() => toggle(option.id)}
                className="mt-0.5 accent-[var(--color-accent)]"
              />
              <span className="flex flex-col gap-1">
                <span>{option.label}</span>
                {committed ? (
                  <>
                    {/* Shape as well as colour, so the answer survives
                        colour-blindness. */}
                    <span className="font-mono text-xs text-muted">
                      {isCorrect
                        ? "✓ correct"
                        : isChosen
                          ? "✗ your answer"
                          : ""}
                    </span>
                    {option.note ? (
                      <span className="text-xs text-muted">{option.note}</span>
                    ) : null}
                  </>
                ) : null}
              </span>
            </label>
          );
        })}
      </fieldset>

      {committed ? null : (
        <button
          type="button"
          disabled={selected.length === 0}
          onClick={() => onCommit({ kind: "classify", selected, hintsUsed })}
          className="self-start rounded-md bg-accent px-5 py-2.5 font-medium text-bg disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Commit answer
        </button>
      )}
    </div>
  );
}
