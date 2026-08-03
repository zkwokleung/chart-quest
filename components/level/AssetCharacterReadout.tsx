"use client";

import { useEffect, useState } from "react";
import type { SeriesId } from "@/lib/chart/types";
import { loadAssetCharacter } from "@/lib/data/load-asset-character";
import type { AssetCharacterFile } from "@/lib/ta/asset-character";

/**
 * Six markets, one statistic, recomputed as the player moves a control.
 *
 * The table is the level. There is no chart, because the thing being compared is not something
 * a chart shows: "does this market's move tend to continue" is a property of thousands of bars
 * at once, and drawing any one window of them would invite the player to answer by eye — which
 * is the habit Chapter 8 exists to replace.
 *
 * **The bars are the teaching and the z column is the correction.** Drag the horizon and
 * Bitcoin's bar crosses the 1.0 line while the others stay left of it, which is a clean,
 * memorable, and *overstated* picture. The z beside it says how much of that to believe: at no
 * horizon is Bitcoin distinguishable from a random walk, and only the index is, at short ones.
 * Showing the ratios without the z would teach a fact the data does not support, in the chapter
 * whose whole subject is measuring rather than asserting.
 */

const LABELS: Partial<Record<SeriesId, string>> = {
  "BTCUSDT-1d": "Bitcoin",
  "SPY-1d": "S&P 500",
  "AAPL-1d": "Apple",
  "EURUSD-1d": "Euro",
  "GC-1d": "Gold",
  "LAKE-1d": "Small-cap",
};

/** The ratio the track's right edge represents. Bitcoin peaks near 1.41. */
const TRACK_MAX = 1.6;

/** Where a ratio of 1.0 falls on that track. The reference frame for every bar. */
const RANDOM_WALK_AT = (1 / TRACK_MAX) * 100;

export function AssetCharacterReadout({
  assets,
  focus,
  horizon,
  label,
}: {
  assets: SeriesId[];
  focus: SeriesId;
  horizon: number;
  label: string;
}) {
  const [file, setFile] = useState<AssetCharacterFile | null>(null);
  const [failed, setFailed] = useState(false);

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
        The measurements could not be loaded, and nothing below this line is worth reading
        without them.
      </p>
    );
  }
  if (!file) {
    return (
      <p className="rounded-lg border border-border bg-surface p-3 text-sm text-muted">
        Measuring…
      </p>
    );
  }

  const rows = assets
    .map((id) => {
      const facts = file.byAsset[id];
      const point = facts?.vr.find((v) => v.q === horizon);
      return point ? { id, vr: point.vr, z: point.z } : null;
    })
    .filter((row): row is { id: SeriesId; vr: number; z: number } => row !== null)
    .sort((a, b) => b.vr - a.vr);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2 font-mono text-xs text-muted">
        <span>
          {label} {horizon}
        </span>
        <span>1.0 is a random walk · * is distinguishable from one</span>
      </div>

      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">
          Variance ratio by market at a {horizon}-bar horizon
        </caption>
        <thead>
          <tr className="text-left font-mono text-xs text-muted">
            <th scope="col" className="py-1 font-normal">
              market
            </th>
            <th scope="col" className="py-1 font-normal">
              ratio
            </th>
            <th scope="col" className="py-1 text-right font-normal">
              value
            </th>
            <th scope="col" className="py-1 text-right font-normal">
              z
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const significant = Math.abs(row.z) >= 2;
            const width = Math.min(100, (row.vr / TRACK_MAX) * 100);
            return (
              <tr
                key={row.id}
                className={row.id === focus ? "text-fg" : "text-muted"}
              >
                <th scope="row" className="py-1 pr-3 text-left font-normal">
                  {LABELS[row.id] ?? row.id}
                  {row.id === focus ? (
                    <span className="ml-1 font-mono text-xs text-accent">←</span>
                  ) : null}
                </th>
                <td className="w-1/2 py-1 pr-3">
                  <div className="relative h-3 rounded-sm bg-bg">
                    <div
                      className="absolute inset-y-0 left-0 rounded-sm"
                      style={{
                        width: `${width}%`,
                        backgroundColor:
                          row.vr >= 1 ? "var(--color-up)" : "var(--color-down)",
                        opacity: row.id === focus ? 1 : 0.55,
                      }}
                    />
                    {/* The 1.0 line, which is the whole reference frame. */}
                    <div
                      className="absolute inset-y-0 w-px bg-fg/60"
                      style={{ left: `${RANDOM_WALK_AT}%` }}
                    />
                  </div>
                </td>
                <td className="py-1 text-right font-mono text-xs">
                  {row.vr.toFixed(3)}
                </td>
                <td className="py-1 text-right font-mono text-xs">
                  {row.z >= 0 ? "+" : ""}
                  {row.z.toFixed(1)}
                  {significant ? "*" : " "}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="text-xs text-muted">{file.definition}</p>
    </div>
  );
}
