/**
 * Playback timing for the replay.
 *
 * Split out from the control component because this is the part that can be
 * wrong. Counting frames instead of time would make speed a lie on a 120 Hz
 * display and stall the replay whenever the tab is throttled; dropping the
 * remainder each tick would make it drift slow. Neither shows up as an obvious
 * bug — the replay would just feel off — so it is worth having under test.
 */

export type Speed = 1 | 2 | 4;

export const SPEEDS: readonly Speed[] = [1, 2, 4];

/** Bars per second at 1x. Slow enough to read a candle as it lands. */
export const BARS_PER_SECOND = 4;

export type Advance = {
  /** Whole bars to reveal now. */
  bars: number;
  /** Time left over, to carry into the next tick rather than discard. */
  carryMs: number;
};

/**
 * Converts elapsed time into whole bars, carrying the remainder.
 *
 * The carry is what makes this correct across uneven frame timing: at 4 bars a
 * second a 16 ms frame earns 0.064 of a bar, and throwing that away every frame
 * would advance roughly never.
 */
export function advanceBy(
  elapsedMs: number,
  speed: Speed,
  carryMs = 0,
): Advance {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
    return { bars: 0, carryMs };
  }
  const msPerBar = 1000 / (BARS_PER_SECOND * speed);
  const total = carryMs + elapsedMs;
  const bars = Math.floor(total / msPerBar);
  return { bars, carryMs: total - bars * msPerBar };
}

/**
 * Caps a single tick's jump.
 *
 * A backgrounded tab can hand back a multi-second delta, which would otherwise
 * skip most of a replay in one frame — the player looks away and the trade is
 * over. Clamped to a quarter-second of bars, so a long pause resumes rather than
 * fast-forwards.
 */
export function clampTick(elapsedMs: number): number {
  return Math.min(elapsedMs, 250);
}
