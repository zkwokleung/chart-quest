"use client";

import { useEffect, useState } from "react";
import {
  loadBaseRates,
  type BaseRates,
  type PatternRates,
} from "@/lib/data/load-base-rates";
import type { PatternKind } from "@/lib/ta/patterns";

/**
 * The measured pattern base rates, revealed after 4.5's ranking is committed.
 *
 * **Every rate is shown with its sample size and its interval, never alone.** That is
 * the entire point of the level: the figures cluster so tightly around a coin flip
 * that the only honest thing to compare between them is how much evidence each one
 * has, and a bare percentage hides exactly that.
 *
 * Fetched rather than bundled, like the price data — see `load-base-rates.ts`.
 */

const ORDER: PatternKind[] = [
  "pin-bar",
  "doji",
  "engulfing",
  "double-top",
  "head-and-shoulders",
];

const LABELS: Record<PatternKind, string> = {
  "pin-bar": "Pin bar",
  doji: "Doji",
  engulfing: "Engulfing",
  "double-top": "Double top",
  "head-and-shoulders": "Head and shoulders",
};

const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

export function BaseRateTable() {
  const [rates, setRates] = useState<BaseRates | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    loadBaseRates().then(
      (loaded) => {
        if (live) setRates(loaded);
      },
      (cause: unknown) => {
        if (live) setError(cause instanceof Error ? cause.message : "unknown");
      },
    );
    return () => {
      live = false;
    };
  }, []);

  if (error) {
    return (
      <p className="font-mono text-xs text-negative">
        The measured rates could not be loaded ({error}). Nothing below this line is
        worth reading without them.
      </p>
    );
  }
  if (!rates) {
    return (
      <p className="font-mono text-xs text-muted" aria-live="polite">
        loading the measured rates…
      </p>
    );
  }

  const widest = (row: PatternRates) => row.pooled.ci95[1] - row.pooled.ci95[0];

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse text-sm">
          <caption className="pb-2 text-left font-mono text-xs text-muted">
            Pooled across {rates.assets.length} markets · win rate over{" "}
            {rates.horizon} bars
          </caption>
          <thead>
            <tr className="border-b border-border text-left font-mono text-xs text-muted">
              <th scope="col" className="py-2 pr-3 font-normal">
                pattern
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-normal">
                n
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-normal">
                win rate
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-normal">
                95% interval
              </th>
              <th scope="col" className="py-2 text-right font-normal">
                mean move
              </th>
            </tr>
          </thead>
          <tbody>
            {ORDER.map((kind) => {
              const row = rates.patterns[kind];
              if (!row) return null;
              const { n, winRate, ci95, meanFwdAtr } = row.pooled;
              return (
                <tr key={kind} className="border-b border-border/50">
                  <th scope="row" className="py-2 pr-3 text-left font-normal">
                    {LABELS[kind]}
                  </th>
                  <td className="py-2 pr-3 text-right font-mono tabular-nums">
                    {n.toLocaleString("en")}
                  </td>
                  <td className="py-2 pr-3 text-right font-mono tabular-nums">
                    {pct(winRate)}
                  </td>
                  <td
                    className="py-2 pr-3 text-right font-mono tabular-nums"
                    // The widest interval is the row the level is about, so it is
                    // marked rather than left for the player to compare by eye.
                    style={
                      widest(row) > 0.15 ? { color: "var(--color-negative)" } : undefined
                    }
                  >
                    {pct(ci95[0])} – {pct(ci95[1])}
                  </td>
                  <td className="py-2 text-right font-mono tabular-nums">
                    {meanFwdAtr >= 0 ? "+" : "−"}
                    {Math.abs(meanFwdAtr).toFixed(2)} ATR
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-sm text-muted">
        Not one of them is a coin flip away from a coin flip, and the mean move is
        under a quarter of a daily range in either direction. What separates them is
        the third column: there are{" "}
        {rates.patterns["pin-bar"]?.pooled.n.toLocaleString("en")} pin bars behind that
        rate and {rates.patterns["head-and-shoulders"]?.pooled.n} head and shoulders
        behind that one.
      </p>

      <details className="text-sm">
        <summary className="cursor-pointer font-mono text-xs text-muted">
          the same pattern, market by market
        </summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left font-mono text-xs text-muted">
                <th scope="col" className="py-2 pr-3 font-normal">
                  pattern
                </th>
                {rates.assets.map((asset) => (
                  <th
                    key={asset}
                    scope="col"
                    className="py-2 pr-3 text-right font-normal"
                  >
                    {asset.replace("-1d", "")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ORDER.map((kind) => (
                <tr key={kind} className="border-b border-border/50">
                  <th scope="row" className="py-2 pr-3 text-left font-normal">
                    {LABELS[kind]}
                  </th>
                  {rates.assets.map((asset) => {
                    const cell = rates.patterns[kind]?.byAsset[asset];
                    return (
                      <td
                        key={asset}
                        className="py-2 pr-3 text-right font-mono text-xs tabular-nums"
                      >
                        {cell ? `${pct(cell.winRate)}` : "—"}
                        <span className="block text-muted">
                          {cell ? `n=${cell.n}` : ""}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-muted">
          The bottom row is where the numbers look most exciting and mean least. Read
          it with the sample sizes underneath and it stops being a finding.
        </p>
      </details>

      <p className="font-mono text-xs text-muted">{rates.definition}</p>
    </div>
  );
}
