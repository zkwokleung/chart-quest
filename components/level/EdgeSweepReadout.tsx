"use client";

import { useEffect, useState } from "react";
import { loadEdgeSweep } from "@/lib/data/load-edge-sweep";
import type { EdgeSweepFile } from "@/lib/ta/edge-sweep";

/**
 * One rule at one lookback, on four markets, in two windows — with the second one withheld.
 *
 * **The withholding is the level.** While the player is tuning they see only the first window,
 * so the control genuinely feels like it is finding something; the later window arrives on
 * commit and says what that was worth. Showing both at once would turn a test of judgement into
 * a reading exercise, which is 9.5's whole failure mode.
 *
 * The number that lands hardest is the **rank**, not the drop. A total falling can be blamed on
 * a shorter window; a rank compares the chosen lookback against twenty-five alternatives
 * measured over the identical bars, and cannot be.
 */

const LABELS: Record<string, string> = {
  "GC-1d": "Gold",
  "SPY-1d": "S&P 500",
  "AAPL-1d": "Apple",
  "BTCUSDT-1d": "Bitcoin",
};

const r = (x: number) => `${x >= 0 ? "+" : ""}${x.toFixed(1)}R`;

export function EdgeSweepReadout({
  lookback,
  revealed,
}: {
  lookback: number;
  revealed: boolean;
}) {
  const [file, setFile] = useState<EdgeSweepFile | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    loadEdgeSweep()
      .then((loaded) => live && setFile(loaded))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

  if (failed) {
    return (
      <p className="rounded-lg border border-down/40 bg-surface p-3 text-sm text-muted">
        The sweep could not be loaded, and nothing below this line is worth reading without it.
      </p>
    );
  }
  if (!file) return <p className="text-sm text-muted">Measuring…</p>;

  // The nearest swept lookback, so a control step that lands between grid points still reads a
  // measured cell rather than an interpolated one.
  const nearest = file.lookbacks.reduce((best, n) =>
    Math.abs(n - lookback) < Math.abs(best - lookback) ? n : best,
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2 font-mono text-xs text-muted">
        <span>breakout of {nearest} bars</span>
        <span>
          {revealed
            ? "both windows · rank 1 is the best of the 26 lookbacks"
            : "the first 70% of each market's history"}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[30rem] border-collapse text-sm">
          <caption className="sr-only">
            Total R by market at a {nearest}-bar lookback
          </caption>
          <thead>
            <tr className="font-mono text-xs text-muted">
              <th scope="col" className="py-1 text-left font-normal">
                market
              </th>
              <th scope="col" className="py-1 text-right font-normal">
                tuning window
              </th>
              <th scope="col" className="py-1 text-right font-normal">
                trades
              </th>
              {revealed ? (
                <>
                  <th scope="col" className="py-1 text-right font-normal">
                    the later third
                  </th>
                  <th scope="col" className="py-1 text-right font-normal">
                    rank
                  </th>
                </>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {file.assets.map((asset) => {
              const cell = asset.cells.find((c) => c.n === nearest)!;
              const best = asset.bestInSample === nearest;
              return (
                <tr key={asset.asset} className="border-t border-border/40">
                  <th scope="row" className="py-1 pr-3 text-left font-normal">
                    {LABELS[asset.asset] ?? asset.asset}
                    {best ? (
                      <span className="ml-2 font-mono text-xs text-accent">
                        best here
                      </span>
                    ) : null}
                  </th>
                  <td
                    className="py-1 text-right font-mono text-xs"
                    style={{
                      color:
                        cell.inSample.totalR > 0
                          ? "var(--color-up)"
                          : "var(--color-down)",
                    }}
                  >
                    {r(cell.inSample.totalR)}
                  </td>
                  <td className="py-1 text-right font-mono text-xs text-muted">
                    {cell.inSample.trades}
                  </td>
                  {revealed ? (
                    <>
                      <td
                        className="py-1 text-right font-mono text-xs"
                        style={{
                          color:
                            cell.later.totalR > 0
                              ? "var(--color-up)"
                              : "var(--color-down)",
                        }}
                      >
                        {r(cell.later.totalR)}
                      </td>
                      <td
                        className="py-1 text-right font-mono text-xs"
                        style={{
                          color:
                            cell.rankLater > file.lookbacks.length / 2
                              ? "var(--color-down)"
                              : undefined,
                        }}
                      >
                        {cell.rankLater} of {file.lookbacks.length}
                      </td>
                    </>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {revealed ? (
        <div className="flex flex-col gap-1 border-t border-border/60 pt-2 text-xs text-muted">
          <p>
            Each market&apos;s best tuning-window lookback, and where that lookback placed in the
            later third:
          </p>
          {file.assets.map((asset) => (
            <p key={asset.asset} className="font-mono">
              {(LABELS[asset.asset] ?? asset.asset).padEnd(9)} best at{" "}
              {asset.bestInSample} bars → ranked {asset.bestInSampleRankLater} of{" "}
              {file.lookbacks.length} later
              {asset.bestInSampleRankLater > file.lookbacks.length / 2
                ? " — worse than most it did not pick"
                : ""}
            </p>
          ))}
          <p className="mt-1 max-w-prose">{file.definition}</p>
        </div>
      ) : (
        <p className="max-w-prose text-xs text-muted">
          Only the tuning window is shown. The rest of each market&apos;s history is held back
          until you commit — which is the only honest way to ask this question.
        </p>
      )}
    </div>
  );
}
