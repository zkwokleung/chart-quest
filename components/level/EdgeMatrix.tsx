"use client";

import { useEffect, useState } from "react";
import type { SeriesId } from "@/lib/chart/types";
import { loadAssetCharacter } from "@/lib/data/load-asset-character";
import type { AssetCharacterFile } from "@/lib/ta/asset-character";

/**
 * What one rule was worth, market by market.
 *
 * The reveal for 8.3 and the artefact for 8.6. It exists because the sentence "the same rule
 * behaves differently in different markets" is the kind of claim a player should refuse to
 * accept in prose — the chapter spends six levels teaching them to — so it arrives as a table
 * of measurements with its trade counts attached, and the rule's own definition underneath.
 *
 * **Per-trade R rather than a total.** A total rewards a market for offering more setups, and
 * the small-cap offers half as many as gold. What the player is comparing is the quality of an
 * opportunity, not how many of them there were, so the count sits beside the figure rather than
 * inside it.
 *
 * **Zero setups is rendered as "none", not as a zero.** `gap-fill` on Bitcoin has no trades at
 * all — a market that never closes cannot gap — and a 0.00 in that cell would read as a rule
 * that broke even. It is the difference between an edge that failed and an edge that was never
 * available, which is the cleanest piece of asset character in the chapter.
 */

const LABELS: Partial<Record<SeriesId, string>> = {
  "BTCUSDT-1d": "Bitcoin",
  "SPY-1d": "S&P 500",
  "AAPL-1d": "Apple",
  "EURUSD-1d": "Euro",
  "GC-1d": "Gold",
  "LAKE-1d": "Small-cap",
};

export function EdgeMatrix({
  only,
  byYear,
}: {
  only?: string[];
  /**
   * Also break one rule down by calendar year.
   *
   * 8.5 needs it because "profitable in every year tested" is a claim about years, and a
   * per-market table cannot refute it. The years are the same measurement sliced differently,
   * so they come from the same artefact rather than a second computation.
   */
  byYear?: string;
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
        The measurements could not be loaded, and the claim above is not worth reading
        without them.
      </p>
    );
  }
  if (!file) {
    return <p className="text-sm text-muted">Measuring…</p>;
  }

  const edges = only
    ? file.edges.filter((edge) => only.includes(edge.id))
    : file.edges;

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse text-sm">
          <caption className="sr-only">
            Per-trade R by rule and market, with trade counts
          </caption>
          <thead>
            <tr className="font-mono text-xs text-muted">
              <th scope="col" className="py-1 text-left font-normal">
                rule
              </th>
              {file.assets.map((id) => (
                <th key={id} scope="col" className="py-1 text-right font-normal">
                  {LABELS[id] ?? id}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {edges.map((edge) => {
              const best = Math.max(
                ...file.assets.map((id) => edge.byAsset[id]?.perTradeR ?? -Infinity),
              );
              return (
                <tr key={edge.id} className="border-t border-border/60">
                  <th scope="row" className="py-1.5 pr-3 text-left font-normal">
                    {edge.label}
                  </th>
                  {file.assets.map((id) => {
                    const cell = edge.byAsset[id];
                    if (!cell || cell.trades === 0) {
                      return (
                        <td
                          key={id}
                          className="py-1.5 text-right font-mono text-xs text-muted"
                        >
                          none
                        </td>
                      );
                    }
                    return (
                      <td key={id} className="py-1.5 text-right font-mono text-xs">
                        <span
                          style={{
                            color:
                              cell.perTradeR > 0
                                ? "var(--color-up)"
                                : "var(--color-down)",
                            fontWeight: cell.perTradeR === best ? 600 : 400,
                          }}
                        >
                          {cell.perTradeR >= 0 ? "+" : ""}
                          {cell.perTradeR.toFixed(2)}R
                        </span>
                        <span className="ml-1 text-muted">({cell.trades})</span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <dl className="flex flex-col gap-1 text-xs text-muted">
        {edges.map((edge) => (
          <div key={edge.id} className="flex gap-2">
            <dt className="shrink-0 font-medium">{edge.label}:</dt>
            <dd>{edge.definition}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted">
        Per trade, in multiples of the risk taken, with the number of trades in brackets.
        Every rule uses the same 2 ATR stop and 2R target, entering only when flat.
      </p>

      {byYear ? <ByYear file={file} edgeId={byYear} /> : null}
    </div>
  );
}

/**
 * One rule, year by year, with every losing market-year marked.
 *
 * A total hides its own composition, which is the whole subject of 8.5: the breakout rule made
 * +157.2R across 557 trades and did it while losing money in 41 separate market-years. Three
 * of the twenty-one years were positive on every market that traded in them.
 */
function ByYear({ file, edgeId }: { file: AssetCharacterFile; edgeId: string }) {
  const edge = file.edges.find((e) => e.id === edgeId);
  if (!edge) return null;

  const years = [
    ...new Set(file.assets.flatMap((id) => Object.keys(edge.byYear[id] ?? {}))),
  ].sort();

  return (
    <div className="flex flex-col gap-2 border-t border-border/60 pt-3">
      <p className="font-mono text-xs text-muted">
        {edge.label}, total R by year — a dash means the market had no bars that year
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse text-sm">
          <caption className="sr-only">Total R by year and market</caption>
          <thead>
            <tr className="font-mono text-xs text-muted">
              <th scope="col" className="py-1 text-left font-normal">
                year
              </th>
              {file.assets.map((id) => (
                <th key={id} scope="col" className="py-1 text-right font-normal">
                  {LABELS[id as SeriesId] ?? id}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {years.map((year) => (
              <tr key={year} className="border-t border-border/40">
                <th scope="row" className="py-1 pr-3 text-left font-mono text-xs font-normal">
                  {year}
                </th>
                {file.assets.map((id) => {
                  const value = edge.byYear[id]?.[year];
                  return (
                    <td key={id} className="py-1 text-right font-mono text-xs">
                      {value === undefined ? (
                        <span className="text-muted">–</span>
                      ) : (
                        <span
                          style={{
                            color:
                              value > 0 ? "var(--color-up)" : "var(--color-down)",
                          }}
                        >
                          {value >= 0 ? "+" : ""}
                          {value.toFixed(1)}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
