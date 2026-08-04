"use client";

import { useMemo, useState } from "react";
import { BlockPalette } from "@/components/strategy/BlockPalette";
import { PlaybookExport } from "@/components/strategy/PlaybookExport";
import { RunReadout } from "@/components/strategy/RunReadout";
import { resolvePalette } from "@/lib/backtest/palette";
import type { Block } from "@/lib/backtest/blocks";
import { variantWarning } from "@/lib/backtest/guards";
import type { KindProps } from "@/lib/levels/kind-module";
import type { ExitRule, RiskRule } from "@/lib/levels/schema";
import { useGameStore } from "@/lib/store/game";

/**
 * The composer, inside a level.
 *
 * Reads the store for one thing only — which blocks the player has unlocked — which a component may
 * do. The grader never sees it: a strategy is scored on what it does, not on whether the player was
 * entitled to the blocks they used, or a saved strategy would stop grading the moment a save was
 * cleared. That split is the same one 9.6 made with the journal.
 *
 * **The run happens on commit, not on every keystroke.** A backtest over three markets is tens of
 * thousands of bars, and recomputing it as the player edits would both stutter and — worse — turn
 * the composer into a slot machine. Chapter 9.5 spent a level showing what happens when you can see
 * the score while you turn the knob; this is that lesson respected in an interface.
 */

const DEFAULT_EXIT: ExitRule = { stopAtr: 2, targetR: 2, timeStopBars: 60 };
const DEFAULT_RISK: RiskRule = { perTradePct: 0.01 };

export function BuildRules({
  level,
  hintsUsed,
  grade,
  attempt,
  onCommit,
}: KindProps<"build-rules">) {
  const { prompt, palette, objective, fixed } = level.config;
  const progress = useGameStore((state) => state.progress);

  const [blocks, setBlocks] = useState<Block[]>([]);
  const [exit, setExit] = useState<ExitRule>(fixed?.exit ?? DEFAULT_EXIT);
  const [risk] = useState<RiskRule>(fixed?.risk ?? DEFAULT_RISK);
  const [variants, setVariants] = useState(1);

  const committed = grade !== null;
  const shown = committed ? (attempt?.entry ?? blocks) : blocks;
  const shownExit = committed ? (attempt?.exit ?? exit) : exit;
  const run = grade?.reference.kind === "run" ? grade.reference : null;

  const available = useMemo(
    () => resolvePalette(palette, progress),
    [palette, progress],
  );
  const warning = variantWarning(variants);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-medium">{prompt}</p>

      <BlockPalette
        available={available}
        blocks={shown}
        disabled={committed}
        onChange={(next) => {
          setBlocks(next);
          // Every edit after the first is a variant. Counted here rather than on commit, because
          // what 9.5 measured is the *searching*, not the submitting.
          setVariants((n) => n + 1);
        }}
      />

      {fixed?.exit ? (
        <p className="font-mono text-xs text-muted">
          Exit fixed for this level: a stop {fixed.exit.stopAtr} ATR away
          {fixed.exit.targetR === null
            ? ", no target"
            : `, a target ${fixed.exit.targetR}R away`}
          , closed after {fixed.exit.timeStopBars} bars.
        </p>
      ) : (
        <fieldset className="flex flex-wrap items-end gap-4 rounded-lg border border-border bg-surface p-3">
          <legend className="px-1 font-mono text-xs text-muted">getting out</legend>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted">stop, in ATR</span>
            <input
              type="number"
              min={0.5}
              max={6}
              step={0.5}
              value={shownExit.stopAtr}
              disabled={committed}
              onChange={(e) => {
                setExit((current) => ({ ...current, stopAtr: Number(e.target.value) }));
                setVariants((n) => n + 1);
              }}
              className="w-24 rounded border border-border bg-bg px-2 py-1 font-mono"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted">target, in R</span>
            <input
              type="number"
              min={1}
              max={6}
              step={0.5}
              value={shownExit.targetR ?? 0}
              disabled={committed}
              onChange={(e) => {
                const value = Number(e.target.value);
                setExit((current) => ({ ...current, targetR: value <= 0 ? null : value }));
                setVariants((n) => n + 1);
              }}
              className="w-24 rounded border border-border bg-bg px-2 py-1 font-mono"
            />
          </label>
          <p className="max-w-prose text-xs text-muted">
            Both in ATR and R rather than in price, so the same rule means the same thing on
            every market — Chapter 8&apos;s toggle, as a strategy.
          </p>
        </fieldset>
      )}

      {warning.warn && !committed ? (
        <p className="max-w-prose rounded-lg border border-border bg-surface p-3 text-xs text-muted">
          {warning.message}
        </p>
      ) : null}

      {committed ? null : (
        <button
          type="button"
          disabled={shown.length === 0}
          onClick={() =>
            onCommit({
              kind: "build-rules",
              entry: blocks,
              exit,
              risk,
              variants,
              hintsUsed,
            })
          }
          className="self-start rounded-md bg-accent px-5 py-2.5 font-medium text-bg disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {shown.length === 0 ? "Add a condition first" : "Run it"}
        </button>
      )}

      {run ? <RunReadout run={run} objective={objective} /> : null}

      {run && level.config.playbook ? (
        <PlaybookExport
          run={run}
          blocks={shown}
          exit={shownExit}
          risk={attempt?.risk ?? risk}
        />
      ) : null}
    </div>
  );
}
