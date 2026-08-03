"use client";

import { useEffect, useState } from "react";
import { loadEdgeSweep } from "@/lib/data/load-edge-sweep";
import type { EdgeSweepFile } from "@/lib/ta/edge-sweep";

/**
 * A profitable curve, and how far it fell on the way.
 *
 * The player sees the total and the trade count and is asked how deep the worst stretch went.
 * The answer arrives on commit, because a drawdown printed next to a total is not a question.
 *
 * **Reads the same artefact as 9.5's readout.** The sweep already walks every lookback's R
 * curve, so one script and one file serve both levels — and the numbers a player meets in 9.3
 * are literally the ones they will tune in 9.5, which is worth more than two separate tables.
 *
 * The guess is drawn as a marker against the measured depth, so being wrong is legible as a
 * distance rather than as a verdict. Every figure carries R as its unit: there is no account
 * here, and a bare percentage would be a percentage of nothing.
 */

const LABELS: Record<string, string> = {
  "GC-1d": "Gold",
  "SPY-1d": "S&P 500",
  "AAPL-1d": "Apple",
  "BTCUSDT-1d": "Bitcoin",
};

/** The market whose curve is the question. The best-looking of the four. */
export const HEADLINE_ASSET = "AAPL-1d";

export function DrawdownReadout({
  guess,
  revealed,
}: {
  guess: number;
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
        The measurements could not be loaded, and the question below is not answerable without
        them.
      </p>
    );
  }
  if (!file) return <p className="text-sm text-muted">Measuring…</p>;

  const asset = file.assets.find((a) => a.asset === HEADLINE_ASSET)!;
  const cell = asset.cells.find((c) => c.n === asset.bestInSample)!;
  const actual = cell.inSample.maxDrawdownR;

  /** The bar track, scaled so both the guess and the answer fit whatever they are. */
  const track = Math.max(guess, actual) * 1.25 || 1;

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-border bg-surface p-3">
        <p className="font-mono text-xs text-muted">
          {LABELS[asset.asset] ?? asset.asset} · breakout of {asset.bestInSample} bars ·{" "}
          {asset.splitDate.slice(0, 4)} and earlier
        </p>
        <p className="mt-1 font-mono text-sm">
          <span style={{ color: "var(--color-up)" }}>
            +{cell.inSample.totalR.toFixed(1)}R
          </span>{" "}
          <span className="text-muted">
            over {cell.inSample.trades} trades — the best-looking of the four markets here
          </span>
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <div className="relative h-4 rounded-sm bg-bg">
          <div
            className="absolute inset-y-0 left-0 rounded-sm"
            style={{
              width: `${Math.min(100, (guess / track) * 100)}%`,
              backgroundColor: "var(--color-accent)",
              opacity: 0.5,
            }}
          />
          {revealed ? (
            <div
              className="absolute inset-y-0 w-0.5"
              style={{
                left: `${Math.min(100, (actual / track) * 100)}%`,
                backgroundColor: "var(--color-down)",
              }}
            />
          ) : null}
        </div>
        <p className="flex justify-between font-mono text-xs">
          <span className="text-muted">your guess {guess.toFixed(1)}R</span>
          {revealed ? (
            <span style={{ color: "var(--color-down)" }}>
              it actually fell {actual.toFixed(1)}R
            </span>
          ) : (
            <span className="text-muted">the answer arrives when you commit</span>
          )}
        </p>
      </div>

      {revealed ? (
        <div className="flex flex-col gap-1 border-t border-border/60 pt-2 text-xs text-muted">
          <p>
            That is {Math.round((actual / cell.inSample.totalR) * 100)}% of everything the rule
            made, given back at its worst point — on the tidiest curve of the four.
          </p>
          {file.assets.map((a) => {
            const c = a.cells.find((x) => x.n === a.bestInSample)!;
            return (
              <p key={a.asset} className="font-mono">
                {(LABELS[a.asset] ?? a.asset).padEnd(9)} +
                {c.inSample.totalR.toFixed(1)}R total, {c.inSample.maxDrawdownR.toFixed(1)}R
                drawdown ({Math.round((c.inSample.maxDrawdownR / c.inSample.totalR) * 100)}% of
                it)
              </p>
            );
          })}
          <p className="mt-1 max-w-prose">
            In R, over the cumulative curve, ordered by trade. Not a percentage of an account —
            there is no account here, and a percentage of nothing is not a number.
          </p>
        </div>
      ) : null}
    </div>
  );
}
