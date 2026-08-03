import type { YAxisMode } from "@/lib/ta/normalize";
import type { AnyLevel } from "./schema";

/**
 * Who gets the price / percent / ATR control, and what mode they open in.
 *
 * These are two questions and `Level.yAxis` was answering both with one value, which meant a
 * level could not open in ATR without also being the reason the control exists. Splitting them
 * here rather than at each kind's call site keeps the rule in one place — and makes it
 * testable, which a decision spread over eight components is not.
 *
 * **Chapter 8 turns the control on everywhere.** Its subject is that a move's size is only
 * meaningful in its own market's units, so from the moment a player reaches it the question
 * "was that big *for this market*" should be one click away on every chart, including replays
 * of Chapter 1. Before that only the levels whose lesson needs it show the control, so a new
 * player is not handed an axis mode nobody has taught them.
 *
 * **The stored preference sets the mode, never the visibility.** A player who left the toggle
 * on ATR in Chapter 8 and then replays 2.3 should see 2.3's own default and no control — a
 * saved setting must not make an earlier chapter sprout an unlock it has not reached.
 */

export const Y_AXIS_EVERYWHERE_FROM = 8;

export type YAxisOption = {
  /** The mode to open in, or undefined to use the player's stored preference. */
  mode?: YAxisMode;
  /** Whether the player may change it. */
  toggle: boolean;
};

/**
 * Pure, and takes no store: the chart supplies the stored preference as its own fallback, so
 * a kind component resolves this without reaching for global state.
 *
 * Composite steps come along for free — `stepAsLevel` copies the boss's `chapter`, so a
 * Chapter 8 boss's stages resolve to `toggle: true` without a special case.
 */
export function yAxisFor(
  level: Pick<AnyLevel, "chapter" | "yAxis">,
): YAxisOption | undefined {
  if (level.chapter >= Y_AXIS_EVERYWHERE_FROM) return { mode: level.yAxis, toggle: true };
  return level.yAxis === undefined ? undefined : { mode: level.yAxis, toggle: true };
}
