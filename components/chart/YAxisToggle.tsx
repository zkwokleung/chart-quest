"use client";

import type { YAxisMode } from "@/lib/ta/normalize";

const MODES: { id: YAxisMode; label: string; hint: string }[] = [
  { id: "price", label: "Price", hint: "The market's own units" },
  { id: "pct", label: "%", hint: "Percent from the first bar shown" },
  { id: "atr", label: "ATR", hint: "Multiples of this market's daily range" },
];

/**
 * Switches what the y-axis measures.
 *
 * Three buttons rather than a select, because the point is that the player can see
 * all three options and try them — Chapter 8 is built on the habit of asking "was
 * that move big *for this market*", and a closed dropdown does not invite the
 * question.
 */
export function YAxisToggle({
  mode,
  onChange,
}: {
  mode: YAxisMode;
  onChange: (mode: YAxisMode) => void;
}) {
  return (
    <div
      className="flex items-center gap-1"
      role="group"
      aria-label="Y-axis units"
    >
      {MODES.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          aria-pressed={mode === option.id}
          title={option.hint}
          className={[
            "rounded border px-2 py-1 font-mono text-xs",
            mode === option.id
              ? "border-accent text-fg"
              : "border-border text-muted hover:border-muted",
            "focus-visible:outline-2 focus-visible:outline-accent",
          ].join(" ")}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
