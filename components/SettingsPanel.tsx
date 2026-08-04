"use client";

import { useState } from "react";
import { useGameStore } from "@/lib/store/game";
import type { YAxisMode } from "@/lib/store/schema";
import { useHydrated } from "@/lib/store/use-hydrated";
import { useReducedMotion } from "@/lib/store/use-reduced-motion";

/**
 * The preferences the store has always modelled and nothing could reach.
 *
 * `updateSettings` had no caller anywhere in the project until M11. The consequence was not a missing
 * page so much as unreachable behaviour: `reducedMotion` is tri-state, `"system"` defers to
 * `prefers-reduced-motion` and `true`/`false` are an explicit choice that wins over it — and there was
 * no way to make that choice. A player who wanted the replay to stop animating without changing their
 * operating system's settings could not.
 *
 * Three controls, and deliberately only three. Everything here already exists in `Persisted`; a
 * settings page is the easiest place in a codebase to start inventing preferences, and every one costs
 * a state to test forever.
 */

const MOTION: { value: boolean | "system"; label: string; hint: string }[] = [
  {
    value: "system",
    label: "Follow my system",
    hint: "Uses your operating system's reduce-motion setting.",
  },
  {
    value: false,
    label: "Animate",
    hint: "The replay plays bar by bar.",
  },
  {
    value: true,
    label: "Do not animate",
    hint: "The replay steps only when you ask it to. Nothing moves on its own.",
  },
];

const AXES: { value: YAxisMode; label: string; hint: string }[] = [
  { value: "price", label: "Price", hint: "The market's own units." },
  { value: "pct", label: "Percent", hint: "Percent from the first bar shown." },
  { value: "atr", label: "ATR", hint: "Multiples of this market's daily range." },
];

export function SettingsPanel() {
  const hydrated = useHydrated();
  const settings = useGameStore((s) => s.profile.settings);
  const updateSettings = useGameStore((s) => s.updateSettings);
  const resetProgress = useGameStore((s) => s.resetProgress);
  const progress = useGameStore((s) => s.progress);
  const journal = useGameStore((s) => s.journal);

  // What reduced motion currently resolves to, which is the only thing "Follow my system" cannot say
  // on its own — a player choosing it deserves to know which way their system is set.
  const effective = useReducedMotion();
  const [confirmingReset, setConfirmingReset] = useState(false);

  if (!hydrated) {
    return (
      <section className="rounded-lg border border-border bg-surface p-4">
        <p className="text-sm text-muted">Reading your settings…</p>
      </section>
    );
  }

  const levels = Object.values(progress).filter((p) => p && p.attempts > 0).length;

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
        <legend className="px-1 font-mono text-xs text-muted">motion</legend>
        {MOTION.map((option) => (
          <label key={String(option.value)} className="flex items-start gap-3 text-sm">
            <input
              type="radio"
              name="reduced-motion"
              checked={settings.reducedMotion === option.value}
              onChange={() => updateSettings({ reducedMotion: option.value })}
              className="mt-0.5 accent-[var(--color-accent)]"
            />
            <span className="flex flex-col">
              <span>{option.label}</span>
              <span className="text-xs text-muted">{option.hint}</span>
            </span>
          </label>
        ))}
        <p className="mt-1 font-mono text-xs text-muted">
          currently: {effective ? "not animating" : "animating"}
          {settings.reducedMotion === "system" ? " — from your system" : ""}
        </p>
      </fieldset>

      <fieldset className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
        <legend className="px-1 font-mono text-xs text-muted">
          which units charts open in
        </legend>
        {AXES.map((option) => (
          <label key={option.value} className="flex items-start gap-3 text-sm">
            <input
              type="radio"
              name="y-axis"
              checked={settings.yAxisMode === option.value}
              onChange={() => updateSettings({ yAxisMode: option.value })}
              className="mt-0.5 accent-[var(--color-accent)]"
            />
            <span className="flex flex-col">
              <span>{option.label}</span>
              <span className="text-xs text-muted">{option.hint}</span>
            </span>
          </label>
        ))}
        <p className="mt-1 max-w-prose text-xs text-muted">
          A level that teaches a particular unit still opens in that one — this is the default
          everywhere else, and you can always switch on the chart itself.
        </p>
      </fieldset>

      <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-medium">Start again</h2>
          <p className="max-w-prose text-sm text-muted">
            This erases everything — {levels} level{levels === 1 ? "" : "s"} played and{" "}
            {journal.length} trade{journal.length === 1 ? "" : "s"} logged — and it cannot be
            undone. There is no account holding a copy. Download one from{" "}
            <strong>Progress</strong> first if there is any chance you want it back.
          </p>
        </div>
        {confirmingReset ? (
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                resetProgress();
                setConfirmingReset(false);
              }}
              className="rounded-md border border-down px-4 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Yes, erase everything
            </button>
            <button
              type="button"
              onClick={() => setConfirmingReset(false)}
              className="rounded-md border border-border px-4 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Keep my progress
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingReset(true)}
            className="self-start rounded-md border border-border px-4 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Erase my progress
          </button>
        )}
      </section>
    </div>
  );
}
