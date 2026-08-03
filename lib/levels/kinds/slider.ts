/**
 * Scoring a control the player drags, shared by `tune-param` and `probe`.
 *
 * The two kinds render nothing alike — one redraws an indicator on a chart, the other
 * recomputes a table across six markets — but they are graded identically, and they are
 * graded identically because they ask the same *kind* of question: move this until you have
 * seen the thing, then tell me what you saw.
 *
 * Extracted rather than duplicated so the two differ only where they genuinely differ.
 * `docs/CONVENTIONS.md` calls near-duplicate helpers the drift that costs most later, and a
 * second copy of a decay curve is exactly that: it would work, then diverge silently the
 * first time one of them was tuned.
 *
 * ## Why exploration is scorable at all
 *
 * Some of these levels have no right answer. 5.1 teaches that a shorter average lags less and
 * whipsaws more, which is a trade-off rather than a puzzle. 8.2 has an answer but it is
 * worthless unless the player swept to find it — a lucky landing on the crossing horizon
 * teaches nothing about horizons. So both kinds keep every resting position and can score the
 * sweep instead of, or as well as, the destination.
 */

/** Full marks inside the tolerance, then a linear decay to zero at three times it. */
const DECAY_MULTIPLE = 2;

/** How much of a control's range the player actually visited, as a fraction. */
export function exploredFraction(
  visited: readonly number[],
  value: number,
  min: number,
  max: number,
): number {
  const span = max - min;
  if (span <= 0) return 0;
  const seen = visited.length > 0 ? visited : [value];
  return (Math.max(...seen) - Math.min(...seen)) / span;
}

/** Distance from the measured answer, forgiving inside `slop`. */
export function scoreAgainstTarget(
  value: number,
  target: number,
  slop: number,
): number {
  const tolerance = Math.max(slop, 0);
  const distance = Math.abs(value - target);
  if (distance <= tolerance) return 1;
  return Math.max(
    0,
    1 - (distance - tolerance) / Math.max(tolerance * DECAY_MULTIPLE, 1e-9),
  );
}

/** Share of the required sweep completed, capped at 1. */
export function scoreExploration(explored: number, required: number): number {
  return Math.max(0, Math.min(1, explored / Math.max(required, 1e-9)));
}
