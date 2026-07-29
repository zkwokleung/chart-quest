"use client";

import { starCap } from "@/lib/levels/grade";

/**
 * Progressive hints, priced before they are taken.
 *
 * The star cost is shown on the button rather than discovered afterwards — a hint
 * the player did not know would cost them a star is a trap, not help.
 */
export function Hints({
  hints,
  used,
  locked,
  onTake,
}: {
  hints: string[];
  used: number;
  locked: boolean;
  onTake: () => void;
}) {
  if (hints.length === 0) return null;
  const remaining = hints.length - used;

  return (
    <aside className="flex flex-col gap-2 rounded-lg border border-border/60 p-4">
      <h2 className="text-xs uppercase tracking-wide text-muted">Hints</h2>

      {hints.slice(0, used).map((hint, i) => (
        <p key={i} className="text-sm leading-relaxed text-muted">
          {i + 1}. {hint}
        </p>
      ))}

      {locked || remaining === 0 ? null : (
        <button
          type="button"
          onClick={onTake}
          className="self-start rounded border border-border px-3 py-1.5 text-xs hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Reveal a hint — caps this attempt at {starCap(used + 1)} star
          {starCap(used + 1) === 1 ? "" : "s"}
        </button>
      )}

      {used > 0 && !locked ? (
        <p className="font-mono text-xs text-muted">
          best possible now: {starCap(used)} star{starCap(used) === 1 ? "" : "s"}
        </p>
      ) : null}
    </aside>
  );
}
