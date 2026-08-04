"use client";

import { useEffect, useState } from "react";
import { RunReadout } from "@/components/strategy/RunReadout";
import type { Block } from "@/lib/backtest/blocks";
import { compileEntry, warmupFor } from "@/lib/backtest/blocks";
import { runStrategy } from "@/lib/backtest/engine";
import { scoreObjective } from "@/lib/backtest/guards";
import type { OosSeriesId } from "@/lib/chart/types";
import { loadOosSeries } from "@/lib/data/load-oos";
import type { OverlaySpec } from "@/lib/levels/schema";
import { useGameStore } from "@/lib/store/game";
import { useHydrated } from "@/lib/store/use-hydrated";

/**
 * The player's own strategy, run on bars the game has never shown them.
 *
 * **The first and only place `lib/data/load-oos.ts` is used.** It has sat unimported since M2, behind a
 * separate id type and a separate manifest, so that the question this asks would be real rather than
 * theatre. `DATA.md` calls that three layers; this component is the one thing on the other side of them.
 *
 * ## Why a component rather than a `build-rules` level
 *
 * The obvious build was a level whose `data` named the `-oos` slices. That needed `LevelSlice.series`
 * widened from `SeriesId` to include `OosSeriesId` — destroying the compile-time half of the holdback
 * guarantee across all seventy-three levels to serve one. So the holdback is loaded here instead, the
 * run is shown as evidence, and the graded question is what the result supports. Which is answerable
 * without knowing the player's strategy at all, because of what the data can and cannot do.
 *
 * ## What it can and cannot say, measured
 *
 * The holdback is the most recent 15% of each series. Run the reference strategy over it and you get
 * **nine trades on the index, three on gold and nine on Bitcoin's four-hour series.** On the index it
 * goes negative — against a baseline that made +0.34R. Nine trades cannot tell you the rule is broken
 * and three certainly cannot tell you it works, and that asymmetry is the level: a sample this size
 * can rule a strategy out and cannot rule one in.
 */

/** The holdback windows. Three markets, three asset classes, as 10.7 requires of the in-sample run. */
const HOLDBACK: OosSeriesId[] = ["SPY-1d-oos", "GC-1d-oos", "BTCUSDT-4h-oos"];

const EXIT = { stopAtr: 2, targetR: 2, timeStopBars: 60 };

type Run = Extract<OverlaySpec, { kind: "run" }>;

export function HoldbackRun() {
  const hydrated = useHydrated();
  const strategies = useGameStore((state) => state.strategies);
  const [result, setResult] = useState<Run | null>(null);
  const [failed, setFailed] = useState(false);

  // The most recently saved strategy. Casting at this boundary rather than typing the store: see the
  // note on `SavedStrategy`, which stays free of `lib/backtest` so every route does not pay for it.
  const saved = [...strategies]
    .sort((a, b) => (a.savedAt ?? "").localeCompare(b.savedAt ?? ""))
    .at(-1);
  const blocks = (saved?.blocks ?? []) as Block[];

  useEffect(() => {
    if (!hydrated || blocks.length === 0) return;
    let cancelled = false;

    void (async () => {
      try {
        const spec = {
          entry: compileEntry(blocks),
          side: "long" as const,
          stop: { kind: "atr" as const, multiple: EXIT.stopAtr },
          target: { kind: "r" as const, multiple: EXIT.targetR },
          timeStopBars: EXIT.timeStopBars,
          warmup: warmupFor(blocks),
        };

        const runs = await Promise.all(
          HOLDBACK.map(async (id) => {
            const series = await loadOosSeries(id);
            // A short holdback cannot afford the full warmup, so it starts where it can. Stated here
            // because it is a real compromise: the first bars of the window are unusable either way.
            const from = Math.min(spec.warmup, Math.floor(series.c.length * 0.15));
            const window = { from, to: series.c.length };
            return {
              asset: id,
              run: runStrategy(series as never, spec, window),
              baseline: runStrategy(series as never, { ...spec, entry: () => true }, window),
            };
          }),
        );

        const scored = scoreObjective(runs, {
          beatBaseline: true,
          minTrades: 30,
          minAssetsPassing: 2,
        });
        if (cancelled) return;

        setResult({
          kind: "run",
          verdict: scored.verdict,
          reason: scored.reason,
          perAsset: scored.metrics.perAsset.map((entry) => ({
            asset: entry.asset,
            trades: entry.metrics.n,
            expectancy: entry.metrics.expectancy,
            totalR: entry.metrics.totalR,
            maxDrawdownR: entry.metrics.maxDrawdownR,
            underpowered: entry.metrics.underpowered,
            baselineR:
              scored.baselines.find((b) => b.asset === entry.asset)?.perTradeR ?? null,
          })),
          passing: scored.passing,
          classesPassing: [...scored.classesPassing],
          equityR: scored.metrics.pooled.equityR,
        });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
    // `blocks` is derived from the store each render, so the length and the saved id are what change.
  }, [hydrated, saved?.id, blocks.length]);

  if (!hydrated) {
    return (
      <section className="rounded-lg border border-border bg-surface p-4">
        <p className="text-sm text-muted">Reading what you saved…</p>
      </section>
    );
  }

  if (blocks.length === 0) {
    return (
      <section className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
        <h2 className="text-lg font-medium">Held back until now</h2>
        <p className="max-w-prose text-sm text-muted">
          You have not saved a strategy yet, so there is nothing to run on the held-back data. Build
          one on the <strong>Strategy</strong> page and come back — but the question below is
          answerable without it, and that is the point of asking it here.
        </p>
        <p className="max-w-prose text-sm text-muted">
          The holdback is the most recent 15% of each series, kept out of every chapter until this one.
          On the daily markets that is around 813 bars, which produces single-digit trade counts for
          any selective rule.
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-medium">
          {saved?.name ?? "Your strategy"}, on data it has never seen
        </h2>
        <p className="max-w-prose text-sm text-muted">
          These bars have been held out of every chapter since the data was committed. Nothing you
          tuned could have touched them, which is what makes this the one honest test in the game —
          and what makes its size the thing to look at first.
        </p>
      </div>
      {/* Derived rather than stored: there are only three states and two of them are already in
          `result` and `failed`, so a third `useState` would be a fourth thing to keep in step. */}
      {!result && !failed ? <p className="text-sm text-muted">Running…</p> : null}
      {failed ? <p className="text-sm">Could not load the held-back data.</p> : null}
      {result ? (
        <RunReadout
          run={result}
          objective={{ beatBaseline: true, minTrades: 30, minAssetsPassing: 2 }}
        />
      ) : null}
    </section>
  );
}
