"use client";

import { useState } from "react";
import { CorrelationMatrix } from "@/components/level/CorrelationMatrix";
import type { KindProps } from "@/lib/levels/kind-module";
import type { SignalId } from "@/lib/ta/correlation";

/**
 * A list of claims, and checkboxes for the ones that do not hold up.
 *
 * Native checkboxes rather than a custom control: they are keyboard-operable, announce their
 * own state, and group under a `fieldset` legend without any of it being written here. Every
 * kind since M3 has had to work without a pointer, and the cheapest way to meet that is to
 * use the element that already does.
 */
export function SpotTheFlaw({
  level,
  feeds,
  hintsUsed,
  grade,
  attempt,
  onCommit,
}: KindProps<"spot-the-flaw">) {
  const { prompt, claims, reveal } = level.config;
  const [flagged, setFlagged] = useState<string[]>([]);

  const committed = grade !== null;
  const shown = committed ? (attempt?.flagged ?? flagged) : flagged;
  const overlay = grade?.reference.kind === "claims" ? grade.reference : null;

  const slice = level.data[0];
  const feed = feeds[0];

  function toggle(id: string) {
    setFlagged((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  }

  /** Verdict per claim, once committed. Null while the player is still deciding. */
  function verdict(id: string): "right" | "missed" | "wrong" | null {
    if (!overlay) return null;
    const marked = overlay.flagged.includes(id);
    const flawed = overlay.flawed.includes(id);
    if (marked && flawed) return "right";
    if (!marked && flawed) return "missed";
    if (marked && !flawed) return "wrong";
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-medium">{prompt}</p>

      <fieldset className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3">
        <legend className="px-1 font-mono text-xs text-muted">
          the case as it was argued
        </legend>
        {claims.map((claim) => {
          const state = verdict(claim.id);
          return (
            <label
              key={claim.id}
              className={[
                "flex cursor-pointer items-start gap-3 rounded-md border p-2.5 text-sm",
                state === "right"
                  ? "border-up"
                  : state === "missed"
                    ? "border-down"
                    : state === "wrong"
                      ? "border-down/60"
                      : "border-transparent hover:border-border",
              ].join(" ")}
            >
              <input
                type="checkbox"
                checked={shown.includes(claim.id)}
                disabled={committed}
                onChange={() => toggle(claim.id)}
                className="mt-0.5 size-4 shrink-0 accent-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              />
              <span className="flex-1">
                {claim.label}
                {claim.note ? (
                  <span className="block font-mono text-xs text-muted">{claim.note}</span>
                ) : null}
              </span>
              {state ? (
                <span className="shrink-0 font-mono text-xs text-muted">
                  {state === "right"
                    ? "adds nothing ✓"
                    : state === "missed"
                      ? "also adds nothing"
                      : "this one was fine"}
                </span>
              ) : null}
            </label>
          );
        })}
      </fieldset>

      {committed ? null : (
        <button
          type="button"
          onClick={() => onCommit({ kind: "spot-the-flaw", flagged, hintsUsed })}
          className="self-start rounded-md bg-accent px-5 py-2.5 font-medium text-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Commit
        </button>
      )}

      {committed && reveal === "signal-correlation" && slice && feed ? (
        <div className="rounded-lg border border-border bg-surface p-3">
          <CorrelationMatrix
            // The feed is fully revealed for this kind, so this is the whole window the
            // level names — the same bars the claims were made about.
            series={feed.visible()}
            signals={claims
              .map((claim) => claim.signal)
              .filter((id): id is SignalId => id !== undefined)}
            from={slice.from}
            to={slice.to}
          />
        </div>
      ) : null}
    </div>
  );
}
