"use client";

import { useState } from "react";
import { BaseRateTable } from "@/components/level/BaseRateTable";
import type { KindProps } from "@/lib/levels/kind-module";

/**
 * An ordered list the player rearranges.
 *
 * **Up/down buttons are the control, not a fallback for one.** Every kind since M3
 * has had to be operable without a pointer, and a drag handle cannot be — so the
 * buttons are the whole implementation rather than an accessible alternative bolted
 * beside a drag surface that would then need to agree with them.
 *
 * Moving a row keeps focus on the row that moved, which is what makes repeated
 * presses work: a list that reorders under a keyboard user and drops focus to the
 * document forces them to tab back in after every single move.
 */
export function SortRank({
  level,
  hintsUsed,
  grade,
  attempt,
  onCommit,
}: KindProps<"sort-rank">) {
  const { prompt, items, topLabel, bottomLabel } = level.config;

  const [order, setOrder] = useState<string[]>(() => items.map((item) => item.id));
  const committed = grade !== null;
  const shown = committed ? (attempt?.order ?? order) : order;

  const byId = new Map(items.map((item) => [item.id, item]));
  const correctPlace =
    grade?.reference.kind === "ranking"
      ? new Set(grade.reference.inPlace)
      : null;

  function move(index: number, delta: number) {
    const next = index + delta;
    if (next < 0 || next >= order.length) return;
    setOrder((current) => {
      const copy = [...current];
      const [moved] = copy.splice(index, 1);
      if (moved !== undefined) copy.splice(next, 0, moved);
      return copy;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-medium">{prompt}</p>

      <ol className="flex flex-col gap-2" aria-label="Your ranking">
        <li className="font-mono text-xs text-muted" aria-hidden>
          ↑ {topLabel}
        </li>
        {shown.map((id, index) => {
          const item = byId.get(id);
          if (!item) return null;
          const placement =
            correctPlace === null
              ? null
              : correctPlace.has(id)
                ? "right place"
                : "wrong place";

          return (
            <li
              key={id}
              className={[
                "flex items-center gap-3 rounded-lg border bg-surface p-3",
                placement === "right place"
                  ? "border-[var(--color-positive)]"
                  : placement === "wrong place"
                    ? "border-[var(--color-negative)]"
                    : "border-border",
              ].join(" ")}
            >
              <span className="w-6 shrink-0 text-center font-mono text-sm text-muted">
                {index + 1}
              </span>
              <span className="flex-1 text-sm">
                {item.label}
                {item.note ? (
                  <span className="block font-mono text-xs text-muted">
                    {item.note}
                  </span>
                ) : null}
              </span>
              {placement ? (
                <span className="font-mono text-xs text-muted">{placement}</span>
              ) : (
                <span className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    // The label names the row, so a screen reader announces which
                    // item is about to move rather than five identical "Move up".
                    aria-label={`Move ${item.label} up`}
                    disabled={index === 0}
                    onClick={(event) => {
                      move(index, -1);
                      event.currentTarget.focus();
                    }}
                    className="rounded-md border border-border px-2 py-1 font-mono text-xs disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${item.label} down`}
                    disabled={index === shown.length - 1}
                    onClick={(event) => {
                      move(index, 1);
                      event.currentTarget.focus();
                    }}
                    className="rounded-md border border-border px-2 py-1 font-mono text-xs disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    ↓
                  </button>
                </span>
              )}
            </li>
          );
        })}
        <li className="font-mono text-xs text-muted" aria-hidden>
          ↓ {bottomLabel}
        </li>
      </ol>

      {committed ? null : (
        <button
          type="button"
          onClick={() => onCommit({ kind: "sort-rank", order, hintsUsed })}
          className="self-start rounded-md bg-accent px-5 py-2.5 font-medium text-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Commit ranking
        </button>
      )}

      {committed && level.config.reveal === "pattern-base-rates" ? (
        <div className="rounded-lg border border-border bg-surface p-3">
          <BaseRateTable />
        </div>
      ) : null}
    </div>
  );
}
