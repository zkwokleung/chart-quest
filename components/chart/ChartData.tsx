"use client";

import { summarise, summaryLine } from "@/lib/chart/summary";
import type { Series } from "@/lib/chart/types";

/**
 * The chart's window as text, for a reader who cannot see it.
 *
 * Collapsed by default in a `<details>`, so it costs a sighted player nothing and is one activation
 * away for everyone else — and it is in the DOM either way, which is what matters for a screen reader
 * moving through the page rather than clicking.
 *
 * **Why it is a sample and not the whole window.** A screen reader reads linearly. Two hundred and
 * fifty rows of OHLC is not a fallback for a chart, it is a way to make the page unusable while
 * technically providing the data. Twenty evenly spaced rows plus a summary is what a glance actually
 * conveys: shape, scale, and where it started and ended.
 *
 * **Why the rows are evenly spaced rather than chosen.** Picking the interesting bars would mean
 * deciding what matters, which is the level's question. `lib/chart/summary.ts` cannot see a level at
 * all — deliberately, because the obvious next feature is "show the bars the level is about" and
 * `Mark` is `bar:${number}`, so that feature is the answer key in text.
 */
export function ChartData({
  series,
  from,
  to,
}: {
  series: Series<string>;
  from: number;
  to: number;
}) {
  const summary = summarise(series, { from, to });
  if (!summary) return null;

  return (
    <details className="mt-1 text-xs">
      <summary className="cursor-pointer font-mono text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
        chart data as text
      </summary>

      <p className="mt-2 max-w-prose">{summaryLine(summary)}</p>

      <table className="mt-2 w-full border-collapse font-mono text-xs">
        <caption className="text-left text-muted">
          {summary.rows.length} bars sampled evenly from {summary.bars}
        </caption>
        <thead>
          <tr className="text-muted">
            <th scope="col" className="py-1 text-left font-normal">
              date
            </th>
            <th scope="col" className="py-1 text-right font-normal">
              open
            </th>
            <th scope="col" className="py-1 text-right font-normal">
              high
            </th>
            <th scope="col" className="py-1 text-right font-normal">
              low
            </th>
            <th scope="col" className="py-1 text-right font-normal">
              close
            </th>
          </tr>
        </thead>
        <tbody>
          {summary.rows.map((row) => (
            <tr key={row.bar} className="border-t border-border/40">
              <th scope="row" className="py-0.5 pr-3 text-left font-normal">
                {row.date}
              </th>
              <td className="py-0.5 text-right">{row.open}</td>
              <td className="py-0.5 text-right">{row.high}</td>
              <td className="py-0.5 text-right">{row.low}</td>
              <td className="py-0.5 text-right">{row.close}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
