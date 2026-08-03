"use client";

import { reportOn, type JournalCell, type JournalStats } from "@/lib/journal/analytics";
import { useGameStore } from "@/lib/store/game";
import { useHydrated } from "@/lib/store/use-hydrated";

/**
 * The player's own trade record, read back.
 *
 * Reads the store directly, which a *component* may do — only graders must stay pure. The
 * precedent is `SliceChart`'s progress read: a fact about the player belongs where the player's
 * state already is.
 *
 * **Waits for `useHydrated` before reading anything.** The store sets `skipHydration`, so the
 * first paint sees an empty journal — and an empty journal is a *sentence* here ("nothing logged
 * yet") rather than a blank, so rendering it early would tell a player with seventeen trades
 * that they have none, then flip. `ChapterMap` makes the same call for the same reason.
 *
 * **Two things it must never do**, because 9.6 is graded on reading it honestly:
 *
 * It never prints a figure without its sample size. Seven planned trades is what a full
 * playthrough leaves, and a per-asset-class expectancy from four of them is the sample-size
 * fallacy of 9.2 turned on the player. Every cell carries `n`, and an underpowered cell says so
 * in words rather than being left to be noticed.
 *
 * It never pools the authored plans into a headline. Ten of the seventeen entries come from
 * 7.B, where the stops were chosen for the player; "your average loss" over those would
 * describe the author. They are shown, in their own row, labelled.
 */

const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)}%`);
const r = (x: number | null) =>
  x === null ? "—" : `${x >= 0 ? "+" : ""}${x.toFixed(2)}R`;

function Figures({ stats }: { stats: JournalStats }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-xs sm:grid-cols-3">
      <div className="flex justify-between gap-2">
        <dt className="text-muted">trades</dt>
        <dd>{stats.n}</dd>
      </div>
      <div className="flex justify-between gap-2">
        <dt className="text-muted">expectancy</dt>
        <dd>{r(stats.expectancy)}</dd>
      </div>
      <div className="flex justify-between gap-2">
        <dt className="text-muted">total</dt>
        <dd>{r(stats.totalR)}</dd>
      </div>
      <div className="flex justify-between gap-2">
        <dt className="text-muted">win rate</dt>
        <dd>
          {pct(stats.winRate)}
          {stats.winRateCi95 ? (
            <span className="text-muted">
              {" "}
              [{pct(stats.winRateCi95[0])}–{pct(stats.winRateCi95[1])}]
            </span>
          ) : null}
        </dd>
      </div>
      <div className="flex justify-between gap-2">
        <dt className="text-muted">average win</dt>
        <dd>{r(stats.avgWinR)}</dd>
      </div>
      <div className="flex justify-between gap-2">
        <dt className="text-muted">average loss</dt>
        <dd>{r(stats.avgLossR)}</dd>
      </div>
      <div className="flex justify-between gap-2">
        <dt className="text-muted">worst run</dt>
        <dd>
          {stats.maxDrawdownR.toFixed(2)}R
          {stats.worstLosingStreak > 1 ? (
            <span className="text-muted"> ({stats.worstLosingStreak} in a row)</span>
          ) : null}
        </dd>
      </div>
    </dl>
  );
}

function Breakdown({ title, cells }: { title: string; cells: JournalCell[] }) {
  if (cells.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <p className="font-mono text-xs text-muted">{title}</p>
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{title}</caption>
        <thead>
          <tr className="font-mono text-xs text-muted">
            <th scope="col" className="py-1 text-left font-normal" />
            <th scope="col" className="py-1 text-right font-normal">
              n
            </th>
            <th scope="col" className="py-1 text-right font-normal">
              expectancy
            </th>
            <th scope="col" className="py-1 text-right font-normal">
              total
            </th>
          </tr>
        </thead>
        <tbody>
          {cells.map((cell) => (
            <tr key={cell.key} className="border-t border-border/40">
              <th scope="row" className="py-1 pr-3 text-left font-normal">
                {cell.label}
                {cell.underpowered ? (
                  <span className="ml-2 font-mono text-xs text-muted">
                    too few to say
                  </span>
                ) : null}
              </th>
              <td className="py-1 text-right font-mono text-xs">{cell.stats.n}</td>
              <td className="py-1 text-right font-mono text-xs text-muted">
                {r(cell.stats.expectancy)}
              </td>
              <td className="py-1 text-right font-mono text-xs">
                {r(cell.stats.totalR)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function JournalPanel() {
  const hydrated = useHydrated();
  const journal = useGameStore((state) => state.journal);
  const report = reportOn(journal);

  if (!hydrated) {
    return (
      <section className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
        <h2 className="text-lg font-medium">Your trades</h2>
        <p className="text-sm text-muted">Reading your record…</p>
      </section>
    );
  }

  if (report.all.n === 0) {
    return (
      <section className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
        <h2 className="text-lg font-medium">Your trades</h2>
        <p className="max-w-prose text-sm text-muted">
          Nothing logged yet. Every trade you place from Chapter 3 onwards is recorded here —
          entry, stop, target, what it returned and why you took it — and Chapter 9 reads it
          back to you.
        </p>
      </section>
    );
  }

  const authored = report.all.n - report.planned.n;

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-medium">Your trades</h2>
        <p className="max-w-prose text-sm text-muted">
          {report.planned.n} you planned yourself
          {authored > 0
            ? `, and ${authored} where the entry and stop were set for you and you chose the size`
            : ""}
          .
        </p>
      </div>

      <Figures stats={report.planned} />

      {authored > 0 ? (
        <details className="text-sm">
          <summary className="cursor-pointer font-mono text-xs text-muted">
            including the {authored} you did not plan
          </summary>
          <div className="mt-2">
            <Figures stats={report.all} />
            <p className="mt-1 max-w-prose text-xs text-muted">
              Kept separate because their stops were chosen for you. Averaging them into your own
              record would describe somebody else&apos;s decisions.
            </p>
          </div>
        </details>
      ) : null}

      <Breakdown title="by market" cells={report.byAssetClass} />
      <Breakdown title="by setup" cells={report.bySetup} />

      <div className="flex flex-col gap-1 border-t border-border/60 pt-3 font-mono text-xs text-muted">
        {report.discipline.gapped > 0 ? (
          <p>
            {report.discipline.gapped} trade
            {report.discipline.gapped === 1 ? "" : "s"} lost more than the 1R the stop
            promised — price gapped through it.
          </p>
        ) : null}
        {report.discipline.excessLossR !== null && report.discipline.excessLossR > 0.01 ? (
          <p>
            Your average loss ran {report.discipline.excessLossR.toFixed(2)}R past the risk you
            set.
          </p>
        ) : null}
        {report.discipline.unreasoned > 0 ? (
          <p>
            {report.discipline.unreasoned} of {report.all.n} carry no stated reason.
          </p>
        ) : null}
        {report.underpowered.length > 0 ? (
          <p>
            Not enough trades to conclude anything about {report.underpowered.join(", ")} — and
            that is not a fault in the record. It is how much a handful of trades can tell you.
          </p>
        ) : null}
      </div>
    </section>
  );
}
