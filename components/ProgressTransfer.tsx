"use client";

import { useMemo, useRef, useState } from "react";
import { useGameStore } from "@/lib/store/game";
import type { Persisted } from "@/lib/store/schema";
import {
  exportSave,
  exportedAtOf,
  importSave,
  summarise,
  type SaveSummary,
} from "@/lib/store/transfer";
import { useHydrated } from "@/lib/store/use-hydrated";

/**
 * Moving a save off this browser, and back onto another one.
 *
 * There are no accounts, so this is not a convenience — it is the only copy a player can make. Clearing
 * site data or changing laptop destroys ten chapters otherwise.
 *
 * **Two deliberate choices in the interaction.** The import shows what the file contains and waits for
 * a second click, because replacing a save cannot be undone and a file picker is one misclick away from
 * the wrong file. And the confirmation is in the page rather than a `window.confirm`: a native dialog
 * cannot say "this file holds 4 chapters and 18 trades, yours holds 9 and 31", which is the only
 * information that makes the decision anything other than a guess.
 */

type Pending = { text: string; summary: SaveSummary; state: Persisted };

const dateOnly = (iso: string | null) => (iso ? iso.slice(0, 10) : "an unknown date");

function Figures({ summary }: { summary: SaveSummary }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-xs sm:grid-cols-4">
      {[
        ["chapters cleared", summary.chaptersCleared],
        ["levels played", summary.levelsPlayed],
        ["stars", summary.totalStars],
        ["trades", summary.trades],
      ].map(([label, value]) => (
        <div key={label} className="flex justify-between gap-2">
          <dt className="text-muted">{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ProgressTransfer() {
  const hydrated = useHydrated();

  // One field per selector, then assembled here. A selector returning `{ profile, progress, ... }`
  // builds a fresh object on every call, which zustand compares by reference — so it never settles.
  // The first version of this component did exactly that and took the page down with React error 185.
  // Every other component in the project selects one field at a time; this is why.
  const profile = useGameStore((s) => s.profile);
  const progress = useGameStore((s) => s.progress);
  const journal = useGameStore((s) => s.journal);
  const strategies = useGameStore((s) => s.strategies);
  const predictions = useGameStore((s) => s.predictions);
  const replaceAll = useGameStore((s) => s.replaceAll);

  const state = useMemo<Persisted>(
    () => ({ profile, progress, journal, strategies, predictions }),
    [profile, progress, journal, strategies, predictions],
  );

  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"imported" | null>(null);

  function download() {
    const text = exportSave(state, new Date().toISOString());
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `chart-quest-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function chose(file: File) {
    setError(null);
    setDone(null);
    const text = await file.text();
    const result = importSave(text);
    if (!result.ok) {
      setPending(null);
      setError(result.error);
      return;
    }
    setPending({
      text,
      state: result.state,
      summary: summarise(result.state, exportedAtOf(text)),
    });
  }

  function apply() {
    if (!pending) return;
    replaceAll(pending.state);
    setPending(null);
    setDone("imported");
    // Or the same file cannot be chosen twice in a row, which is confusing when the first attempt
    // was cancelled rather than applied.
    if (fileRef.current) fileRef.current.value = "";
  }

  function cancel() {
    setPending(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  const mine = hydrated ? summarise(state, null) : null;

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-medium">Move your progress</h2>
        <p className="max-w-prose text-sm text-muted">
          There are no accounts here, so everything you have done lives in this browser and nowhere
          else. Clearing site data or switching computer loses it. Download a copy and you can put it
          back — on this machine or another one.
        </p>
      </div>

      {mine ? (
        <div className="flex flex-col gap-1">
          <p className="font-mono text-xs text-muted">what this browser holds</p>
          <Figures summary={mine} />
        </div>
      ) : (
        <p className="text-sm text-muted">Reading your progress…</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={download}
          disabled={!hydrated}
          className="rounded-md bg-accent px-5 py-2.5 font-medium text-bg disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Download a copy
        </button>

        {/* A native file input, labelled. Nothing custom: this is the one control where a bespoke
            drop zone would trade real keyboard and screen-reader support for a nicer rectangle. */}
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted">Restore from a file</span>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void chose(file);
            }}
            className="max-w-56 text-xs file:mr-2 file:rounded file:border file:border-border file:bg-bg file:px-3 file:py-1.5 file:text-sm file:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
        </label>
      </div>

      {error ? (
        <p role="alert" className="max-w-prose rounded-lg border border-down bg-bg p-3 text-sm">
          {error} <span className="text-muted">Nothing has been changed.</span>
        </p>
      ) : null}

      {done ? (
        <p role="status" className="max-w-prose text-sm">
          Progress restored. <span className="text-muted">Your chapters are as that file left them.</span>
        </p>
      ) : null}

      {pending ? (
        <div className="flex flex-col gap-3 rounded-lg border border-accent bg-bg p-3">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">
              Replace what is in this browser with this file?
            </p>
            <p className="max-w-prose text-sm text-muted">
              Saved on {dateOnly(pending.summary.exportedAt)}. This cannot be undone — whatever is in
              this browser now will be gone, so download a copy of it first if you are not sure.
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <p className="font-mono text-xs text-muted">the file holds</p>
            <Figures summary={pending.summary} />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={apply}
              className="rounded-md bg-accent px-4 py-2 font-medium text-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Replace my progress
            </button>
            <button
              type="button"
              onClick={cancel}
              className="rounded-md border border-border px-4 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Keep what I have
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
