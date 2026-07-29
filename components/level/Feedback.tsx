"use client";

import Link from "next/link";
import { Stars } from "@/components/ui/Stars";
import type { Grade } from "@/lib/levels/grade";
import type { AnyLevel } from "@/lib/levels/schema";

/**
 * What the player sees after committing.
 *
 * Leads with the diagnosis, not the score. A number tells them they were wrong; a
 * named misconception tells them why, which is the only part that changes their
 * next attempt.
 */
export function Feedback({
  level,
  grade,
  nextHref,
  onRetry,
}: {
  level: AnyLevel;
  grade: Grade;
  nextHref: string | null;
  onRetry: () => void;
}) {
  const passed = grade.stars > 0;

  return (
    <section
      aria-live="polite"
      className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5"
    >
      <div className="flex flex-wrap items-center gap-4">
        <Stars earned={grade.stars} />
        <span className="text-sm text-muted">
          {Math.round(grade.score * 100)}%
        </span>
        {grade.detail
          ? Object.entries(grade.detail).map(([key, value]) => (
              <span key={key} className="font-mono text-xs text-muted">
                {key}: {value}
                {key === "accuracy" ? "%" : ""}
              </span>
            ))
          : null}
      </div>

      {grade.diagnosis.length > 0 ? (
        <div className="flex flex-col gap-2">
          {grade.diagnosis.map((entry, i) => (
            <p
              key={entry.id}
              className={
                i === 0
                  ? "text-sm leading-relaxed"
                  : "text-sm leading-relaxed text-muted"
              }
            >
              {entry.message}
            </p>
          ))}
        </div>
      ) : passed ? (
        <p className="text-sm text-muted">Correct.</p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onRetry}
          className="rounded border border-border px-4 py-2 text-sm hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {/* Replaying is free and starts fresh — the cost of guessing is the
              teaching moment, not a lockout. */}
          Try again
        </button>
        {nextHref ? (
          <Link
            href={nextHref}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Next level →
          </Link>
        ) : null}
        <Link
          href={`/chapter/${level.chapter}`}
          className="rounded border border-border px-4 py-2 text-sm hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Back to chapter
        </Link>
      </div>
    </section>
  );
}
