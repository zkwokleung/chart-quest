"use client";

import type { Block, BlockKind } from "@/lib/backtest/blocks";
import { describeBlock } from "@/lib/backtest/describe";
import { PALETTE } from "@/lib/backtest/palette";

/**
 * The palette, and the stack the player builds from it.
 *
 * Native `<select>` and `<button>` throughout, no primitive library. The project has met the
 * keyboard requirement on twelve kinds this way, and a listbox with focus management written by hand
 * is the thing shadcn would have been worth adopting for — issue #30 stays open for M11's
 * accessibility pass, with the weight measured then rather than guessed now.
 *
 * **Locked entries are shown, not hidden.** A palette that omits what the player has not reached
 * says nothing; one that shows it greyed with the chapter that teaches it is the progression made
 * visible, which is the whole reason #28 asks for the palette to be progress-gated. It also stops
 * Chapter 10 looking like it has five options when the player has three.
 */

/** A defensible starting form for each kind, so adding a block never lands on an invalid one. */
const STARTERS: Record<BlockKind, Block> = {
  structure: { kind: "structure", event: "bos-up" },
  zone: { kind: "zone", touching: "support" },
  cross: {
    kind: "cross",
    fast: { kind: "sma", period: 20 },
    slow: { kind: "sma", period: 50 },
    dir: "above",
  },
  compare: {
    kind: "compare",
    left: { kind: "close" },
    op: ">",
    right: { kind: "sma", period: 200 },
  },
  volatility: { kind: "volatility", atrPct: { op: "<", value: 2 } },
};

export function BlockPalette({
  available,
  blocks,
  disabled,
  onChange,
}: {
  available: BlockKind[];
  blocks: Block[];
  disabled: boolean;
  onChange: (blocks: Block[]) => void;
}) {
  const entries = PALETTE.map((entry) => ({
    ...entry,
    unlocked: available.includes(entry.kind),
  }));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3">
        <p className="font-mono text-xs text-muted">
          conditions you have earned — all of them must hold on the same bar
        </p>
        <ul className="flex flex-wrap gap-2">
          {entries.map((entry) => (
            <li key={entry.kind}>
              <button
                type="button"
                disabled={disabled || !entry.unlocked}
                onClick={() => onChange([...blocks, STARTERS[entry.kind]])}
                title={
                  entry.unlocked
                    ? undefined
                    : `Chapter ${entry.chapter} — ${entry.taughtBy}`
                }
                className={[
                  "rounded border px-3 py-1.5 text-left text-sm",
                  entry.unlocked
                    ? "border-border hover:border-accent"
                    : "border-border/40 text-muted",
                ].join(" ")}
              >
                {entry.unlocked ? "+ " : "🔒 "}
                {entry.label}
                {entry.unlocked ? null : (
                  <span className="ml-2 font-mono text-xs">Ch {entry.chapter}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3">
        <p className="font-mono text-xs text-muted">
          {blocks.length === 0
            ? "your rule — nothing yet"
            : `your rule — ${blocks.length} condition${blocks.length === 1 ? "" : "s"}`}
        </p>
        {blocks.length === 0 ? (
          <p className="max-w-prose text-sm text-muted">
            A rule with no conditions fires on nothing, not on everything. Add one above.
          </p>
        ) : (
          <ol className="flex flex-col gap-1">
            {blocks.map((block, i) => (
              <li
                key={`${block.kind}-${i}`}
                className="flex items-baseline gap-3 border-b border-border/30 pb-1 text-sm"
              >
                <span className="font-mono text-xs text-muted">
                  {i === 0 ? "when" : "and"}
                </span>
                <span className="flex-1">{describeBlock(block)}</span>
                {disabled ? null : (
                  <button
                    type="button"
                    onClick={() => onChange(blocks.filter((_b, k) => k !== i))}
                    aria-label={`Remove: ${describeBlock(block)}`}
                    className="font-mono text-xs text-muted hover:text-fg"
                  >
                    remove
                  </button>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
