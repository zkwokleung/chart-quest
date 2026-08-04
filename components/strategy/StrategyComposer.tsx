"use client";

import { useState } from "react";
import { BlockPalette } from "@/components/strategy/BlockPalette";
import { RunReadout } from "@/components/strategy/RunReadout";
import type { Block } from "@/lib/backtest/blocks";
import { compileEntry, warmupFor } from "@/lib/backtest/blocks";
import { runStrategy } from "@/lib/backtest/engine";
import { scoreObjective, variantWarning } from "@/lib/backtest/guards";
import { unlockedBlocks } from "@/lib/backtest/palette";
import { loadSeries } from "@/lib/data/load-series";
import type { SeriesId } from "@/lib/chart/types";
import type { OverlaySpec } from "@/lib/levels/schema";
import { useGameStore } from "@/lib/store/game";
import { useHydrated } from "@/lib/store/use-hydrated";

/**
 * The workbench: compose a rule, run it on three markets, save it.
 *
 * Not a level. Nothing here is graded, and that is what it is for — Chapter 10's levels each ask one
 * question about a strategy, and a player also needs somewhere to try things without being scored.
 * 10.B exports whatever is saved here.
 *
 * **Runs on demand, never as the player types.** A backtest over three markets is thirteen thousand
 * bars, and 9.5 spent a level showing what happens when you can watch the score while you turn the
 * knob. The variant counter is the other half of that: it counts edits, and says what tuning costs
 * once there have been ten.
 *
 * The three markets are fixed and span three asset classes, because 10.7's objective is the whole
 * point of the chapter and a workbench that let the player pick one market would let them practise
 * the thing the chapter exists to prevent.
 */

/** One equity, one commodity, one crypto. Three classes, so "it travels" means something. */
const SCOPE: SeriesId[] = ["SPY-1d", "GC-1d", "BTCUSDT-1d"];

const DEFAULT_EXIT = { stopAtr: 2, targetR: 2, timeStopBars: 60 };

type Run = Extract<OverlaySpec, { kind: "run" }>;

export function StrategyComposer() {
  const hydrated = useHydrated();
  const progress = useGameStore((state) => state.progress);
  const strategies = useGameStore((state) => state.strategies);
  const saveStrategy = useGameStore((state) => state.saveStrategy);

  const [blocks, setBlocks] = useState<Block[]>([]);
  const [name, setName] = useState("My strategy");
  const [variants, setVariants] = useState(0);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Run | null>(null);
  const [error, setError] = useState<string | null>(null);

  const available = hydrated ? unlockedBlocks(progress) : [];
  const warning = variantWarning(variants);
  const saved = strategies.find((s) => s.name === name);

  async function run() {
    setRunning(true);
    setError(null);
    try {
      const spec = {
        entry: compileEntry(blocks),
        side: "long" as const,
        stop: { kind: "atr" as const, multiple: DEFAULT_EXIT.stopAtr },
        target: { kind: "r" as const, multiple: DEFAULT_EXIT.targetR },
        timeStopBars: DEFAULT_EXIT.timeStopBars,
        warmup: warmupFor(blocks),
      };
      const baselineSpec = { ...spec, entry: () => true };

      const runs = await Promise.all(
        SCOPE.map(async (id) => {
          const series = await loadSeries(id);
          const window = { from: spec.warmup, to: series.c.length };
          return {
            asset: id,
            run: runStrategy(series, spec, window),
            baseline: runStrategy(series, baselineSpec, window),
          };
        }),
      );

      const scored = scoreObjective(runs, {
        beatBaseline: true,
        minTrades: 30,
        minAssetsPassing: 2,
        minClassesPassing: 2,
      });

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
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not run the backtest.");
    } finally {
      setRunning(false);
    }
  }

  if (!hydrated) {
    return (
      <section className="rounded-lg border border-border bg-surface p-4">
        <p className="text-sm text-muted">Reading what you have unlocked…</p>
      </section>
    );
  }

  if (available.length === 0) {
    return (
      <section className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
        <h2 className="text-lg font-medium">Nothing to build with yet</h2>
        <p className="max-w-prose text-sm text-muted">
          Every condition you can compose with is something a chapter taught you. Chapter 2 gives
          you structure, Chapter 3 levels, Chapter 5 indicators, Chapter 8 volatility. Play one and
          come back — the palette grows with you, and that is the point of it.
        </p>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <BlockPalette
        available={available}
        blocks={blocks}
        disabled={running}
        onChange={(next) => {
          setBlocks(next);
          setVariants((n) => n + 1);
          // The old result described the old rule. Keeping it on screen while the rule changed
          // would be the one dishonest thing this page could do.
          setResult(null);
        }}
      />

      <p className="font-mono text-xs text-muted">
        Run on {SCOPE.join(", ")} — one equity, one commodity, one crypto. A rule that only works on
        one of them has not travelled, which is what Chapter 10.7 grades.
      </p>

      {warning.warn ? (
        <p className="max-w-prose rounded-lg border border-border bg-surface p-3 text-xs text-muted">
          {warning.message}
        </p>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <button
          type="button"
          disabled={blocks.length === 0 || running}
          onClick={() => void run()}
          className="rounded-md bg-accent px-5 py-2.5 font-medium text-bg disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {running ? "Running…" : "Run the backtest"}
        </button>

        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted">name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-56 rounded border border-border bg-bg px-2 py-1.5 text-sm"
          />
        </label>

        <button
          type="button"
          disabled={blocks.length === 0}
          onClick={() =>
            saveStrategy({
              name,
              blocks,
              lastResult: result,
              scope: SCOPE,
              variants,
            })
          }
          className="rounded-md border border-border px-4 py-2 text-sm disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {saved ? "Save over it" : "Save"}
        </button>

        {saved ? (
          <p className="font-mono text-xs text-muted">
            saved{saved.savedAt ? ` ${saved.savedAt.slice(0, 10)}` : ""}
            {saved.variants ? ` after ${saved.variants} variants` : ""}
          </p>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-lg border border-down bg-surface p-3 text-sm">{error}</p>
      ) : null}

      {result ? (
        <RunReadout
          run={result}
          objective={{
            beatBaseline: true,
            minTrades: 30,
            minAssetsPassing: 2,
            minClassesPassing: 2,
          }}
        />
      ) : null}
    </div>
  );
}
