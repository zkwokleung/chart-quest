"use client";

import { useState } from "react";
import { EdgeMatrix } from "@/components/level/EdgeMatrix";
import { CorrelationMatrix } from "@/components/level/CorrelationMatrix";
import { FeedChart } from "@/components/level/FeedChart";
import type { KindProps } from "@/lib/levels/kind-module";
import { yAxisFor } from "@/lib/levels/y-axis";
import type { SignalId } from "@/lib/ta/correlation";

/**
 * A list of claims, and checkboxes for the ones that do not hold up.
 *
 * Native checkboxes rather than a custom control: they are keyboard-operable, announce their
 * own state, and group under a `fieldset` legend without any of it being written here. Every
 * kind since M3 has had to work without a pointer, and the cheapest way to meet that is to
 * use the element that already does.
 *
 * **The market the claims are about is drawn, where the level names one.** `AUTHORING.md`
 * introduced this kind "for an artefact that is not a chart", and the artefact still is not one —
 * but 6.5 declares `BTCUSDT · daily` and 8.5 declares `S&P 500 · 2022`, both labelled, and neither
 * appeared anywhere. A level that loads and labels a window is asking for it to be shown; the
 * slice was reaching the component and being used only by the correlation reveal. 9.B is three
 * reports on three markets and would have been three tables.
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

      {slice && feed ? (
        <FeedChart
          slice={slice}
          feed={feed}
          height={260}
          showVolume={false}
          yAxis={yAxisFor(level)}
        />
      ) : null}

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
                {/* **After committing only.** A note here is a verdict — every one of 8.5's
                    begins "True, and…" or "The premise is true and the conclusion is not" — so
                    rendering them beside the checkboxes printed the answer next to the question.
                    `classify` had this right and this kind did not, from M6 until 9.B's stages
                    made it obvious. `sort-rank` shows its notes throughout on purpose: there they
                    are the pattern definitions the ranking is *from*. */}
                {committed && claim.note ? (
                  <span className="block font-mono text-xs text-muted">{claim.note}</span>
                ) : null}
              </span>
              {state ? (
                <span className="shrink-0 font-mono text-xs text-muted">
                  {/* Neutral wording, because the kind's flaws are not all one thing. 6.5's are
                      redundancy — "adds nothing", which these labels used to say — and 8.5's and
                      9.B's are true premises with conclusions that do not follow. */}
                  {state === "right"
                    ? "flawed ✓"
                    : state === "missed"
                      ? "also flawed"
                      : "this one was sound"}
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

      {committed && level.config.reveal === "rule-by-year" ? (
        <div className="rounded-lg border border-border bg-surface p-3">
          <EdgeMatrix only={["breakout-20"]} byYear="breakout-20" />
        </div>
      ) : null}
    </div>
  );
}
