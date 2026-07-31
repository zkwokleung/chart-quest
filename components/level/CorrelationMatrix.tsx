"use client";

import type { Series } from "@/lib/chart/types";
import {
  correlationMatrix,
  REDUNDANT_ABOVE,
  type SignalId,
} from "@/lib/ta/correlation";

/**
 * The measured correlation between the readings 6.5 asks about.
 *
 * The level's argument is that several of its confirmations are one fact restated, and this
 * is where that stops being rhetoric: the numbers are computed from the same window the
 * level names, so the player can see which claims move together.
 *
 * Cells at or above the redundancy threshold are marked, because the point is a *pattern*
 * in the matrix — one block of high numbers and everything else low — and asking someone to
 * find that by reading thirty figures would bury it.
 */

const LABELS: Record<SignalId, string> = {
  rsi: "RSI",
  "macd-histogram": "MACD hist",
  "price-vs-sma20": "px vs MA20",
  "sma20-vs-sma50": "MA20 vs MA50",
  "return-10": "10-bar return",
  "range-vs-atr": "range vs ATR",
};

export function CorrelationMatrix({
  series,
  signals,
  from,
  to,
}: {
  series: Series<string>;
  signals: SignalId[];
  from: number;
  to: number;
}) {
  if (signals.length < 2) return null;
  const matrix = correlationMatrix(series, signals, { from, to });

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <table className="border-collapse text-sm">
          <caption className="pb-2 text-left font-mono text-xs text-muted">
            Correlation over {to - from} bars of {series.id} · marked at{" "}
            {REDUNDANT_ABOVE.toFixed(2)} and above
          </caption>
          <thead>
            <tr className="text-left font-mono text-xs text-muted">
              <th scope="col" className="py-2 pr-3 font-normal" />
              {signals.map((id) => (
                <th key={id} scope="col" className="px-2 py-2 text-right font-normal">
                  {LABELS[id]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {signals.map((rowId, i) => (
              <tr key={rowId} className="border-t border-border/50">
                <th
                  scope="row"
                  className="whitespace-nowrap py-2 pr-3 text-left font-normal"
                >
                  {LABELS[rowId]}
                </th>
                {signals.map((colId, j) => {
                  const value = matrix.rows[i]?.[j] ?? null;
                  const self = i === j;
                  const redundant =
                    !self && value !== null && Math.abs(value) >= REDUNDANT_ABOVE;
                  return (
                    <td
                      key={colId}
                      className={[
                        "px-2 py-2 text-right font-mono tabular-nums",
                        self ? "text-muted" : "",
                        redundant ? "font-medium" : "",
                      ].join(" ")}
                      style={redundant ? { color: "var(--color-down)" } : undefined}
                    >
                      {value === null ? "—" : value.toFixed(2)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-muted">
        Everything marked in the table is a pair of readings that move together. Three of
        these confirmations sit in one block above {REDUNDANT_ABOVE.toFixed(2)} — they are
        the same observation with three different names on it. The other two correlate with
        nothing, which is what makes them worth having.
      </p>
    </div>
  );
}
