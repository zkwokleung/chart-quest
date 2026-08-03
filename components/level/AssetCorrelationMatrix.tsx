"use client";

import { useEffect, useState } from "react";
import type { SeriesId } from "@/lib/chart/types";
import { loadAssetCharacter } from "@/lib/data/load-asset-character";
import type { AssetCharacterFile } from "@/lib/ta/asset-character";

/**
 * How six markets moved together, on all days and on the days that mattered.
 *
 * A separate component from `CorrelationMatrix`, which correlates *indicator readings on one
 * chart* for level 6.5. This correlates *markets against each other*, indexed by date. Same
 * word, different question: there a row is a signal, here a row is a market, and the
 * highlight means "rose when it counted" rather than "duplicates another". Sharing a
 * `<table>` between them would be twenty lines of markup behind six configuration props, so
 * they are two components until a third one argues otherwise.
 *
 * **The switch is ungraded on purpose.** Flipping between all days and the index's worst tenth
 * is where the lesson happens, and a player who flips it four times has understood more than
 * one who read a number. The `<details>` disclosure in `BaseRateTable` set the precedent for
 * exploration inside a reveal.
 *
 * **Every cell carries its sample.** 1,429 aligned days becomes 142 in the worst decile, and a
 * correlation from 142 observations is a weaker claim than one from 1,428. The chapter spends
 * two levels teaching that, so the matrix cannot quietly drop it.
 */

const LABELS: Partial<Record<SeriesId, string>> = {
  "BTCUSDT-1d": "BTC",
  "SPY-1d": "SPY",
  "AAPL-1d": "AAPL",
  "EURUSD-1d": "EUR",
  "GC-1d": "Gold",
  "LAKE-1d": "Small",
};

type View = "allDays" | "indexWorstDecile" | "calmDays";

const VIEWS: { id: View; label: string; hint: string }[] = [
  { id: "allDays", label: "All days", hint: "every day all six markets traded" },
  {
    id: "indexWorstDecile",
    label: "The index's worst 10%",
    hint: "the days a diversified book is supposed to be for",
  },
  { id: "calmDays", label: "Ordinary days", hint: "the middle tenth, for contrast" },
];

/** Above this, two markets are close enough to being one position to say so. */
const REDUNDANT_ABOVE = 0.6;

export function AssetCorrelationMatrix() {
  const [file, setFile] = useState<AssetCharacterFile | null>(null);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<View>("allDays");

  useEffect(() => {
    let live = true;
    loadAssetCharacter()
      .then((loaded) => live && setFile(loaded))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

  if (failed) {
    return (
      <p className="rounded-lg border border-down/40 bg-surface p-3 text-sm text-muted">
        The measurements could not be loaded, and the claim above is not worth reading
        without them.
      </p>
    );
  }
  if (!file) return <p className="text-sm text-muted">Measuring…</p>;

  const matrix = file.correlation[view];
  const all = file.correlation.allDays;
  const chosen = VIEWS.find((v) => v.id === view)!;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1" role="group" aria-label="Which days to measure">
        {VIEWS.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={view === option.id}
            onClick={() => setView(option.id)}
            className={[
              "rounded-md border px-2.5 py-1 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              view === option.id
                ? "border-accent text-fg"
                : "border-border text-muted hover:border-accent",
            ].join(" ")}
          >
            {option.label}
          </button>
        ))}
      </div>

      <p className="font-mono text-xs text-muted" aria-live="polite">
        {chosen.hint} · {matrix.n} days
      </p>

      <div className="overflow-x-auto">
        <table className="border-collapse text-sm">
          <caption className="sr-only">
            Correlation of daily returns between markets, {chosen.hint}
          </caption>
          <thead>
            <tr className="font-mono text-xs text-muted">
              <th scope="col" className="py-1 pr-2 text-left font-normal" />
              {matrix.assets.map((id) => (
                <th key={id} scope="col" className="px-2 py-1 text-right font-normal">
                  {LABELS[id as SeriesId] ?? id}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.assets.map((rowId, i) => (
              <tr key={rowId}>
                <th
                  scope="row"
                  className="py-1 pr-2 text-left font-mono text-xs font-normal text-muted"
                >
                  {LABELS[rowId as SeriesId] ?? rowId}
                </th>
                {matrix.assets.map((colId, j) => {
                  if (i === j) {
                    return (
                      <td key={colId} className="px-2 py-1 text-right font-mono text-xs text-muted">
                        —
                      </td>
                    );
                  }
                  const value = matrix.rows[i]?.[j] ?? null;
                  const base = all.rows[i]?.[j] ?? null;
                  const rose =
                    view === "indexWorstDecile" &&
                    value !== null &&
                    base !== null &&
                    value - base >= 0.15;
                  return (
                    <td
                      key={colId}
                      className="px-2 py-1 text-right font-mono text-xs"
                      style={{
                        color:
                          value !== null && Math.abs(value) >= REDUNDANT_ABOVE
                            ? "var(--color-down)"
                            : undefined,
                        fontWeight: rose ? 600 : 400,
                      }}
                    >
                      {value === null ? "–" : value.toFixed(2)}
                      {rose ? "↑" : ""}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted">
        An arrow marks a pair that rose by 0.15 or more against its all-days figure. Red is
        0.6 or above — close enough to being one position to treat it as one.
      </p>

      <div className="flex flex-col gap-1 border-t border-border/60 pt-2">
        <p className="font-mono text-xs text-muted">
          the equal-weight book&apos;s worst falls, and what each market did across them
        </p>
        {file.correlation.jointDrawdowns.slice(0, 3).map((run) => (
          <p key={run.from} className="font-mono text-xs">
            <span className="text-muted">
              {run.from} → {run.to}
            </span>{" "}
            <span style={{ color: "var(--color-down)" }}>
              book {(run.book * 100).toFixed(1)}%
            </span>{" "}
            <span className="text-muted">
              {matrix.assets
                .map(
                  (id, k) =>
                    `${LABELS[id as SeriesId] ?? id} ${(run.perAsset[k]! * 100).toFixed(0)}%`,
                )
                .join(" · ")}
            </span>
          </p>
        ))}
      </div>
    </div>
  );
}
