import type { BarRange, Series } from "@/lib/chart/types";

/**
 * A window onto a series that reveals bars one at a time.
 *
 * The invariant is worth stating precisely, because the loose version ("a
 * component cannot read ahead") is not quite what this buys. `visible()` is the
 * only way to read bars *and* the only thing the chart renders, so **what a
 * component can read is exactly what the player can see.** Advancing the feed is
 * not a leak — it shows the player those bars too. Reading unrevealed bars while
 * displaying fewer is the failure this makes structurally impossible, and it is
 * the one that matters: it is how a `predict-next` kind would come to know the
 * answer before the player committed.
 *
 * The series itself is held in a closure `createFeed` owns, so nothing reachable
 * from this object leads back to it.
 *
 * Graders are the deliberate exception: they take the full series, because scoring
 * a prediction or a trade means knowing what actually happened.
 */
export type ReplayFeed = {
  /** Absolute index of the last revealed bar. */
  readonly at: number;
  /** First bar of the level's window. */
  readonly first: number;
  /** The last bar this feed will ever reveal. */
  readonly last: number;
  readonly done: boolean;
  /**
   * The revealed bars, as a series.
   *
   * Arrays are truncated at `at` rather than re-based at `first`, so an absolute
   * bar index still means what the level file said it means: `visible().l[1058]`
   * is bar 1058's low, and `visible().l[1059]` is `undefined` rather than the
   * future. Re-basing would have shifted every index in 15 authored levels and
   * reopened the off-by-`from` trap that bit `mark-bars` and the drawing
   * primitive.
   */
  visible(): Series<string>;
  /** Reveals `n` more bars, stopping at `last`. */
  step(n?: number): void;
  /** Moves the reveal point anywhere in the window, forwards or back. */
  seek(bar: number): void;
  reset(): void;
  /**
   * Notifies when the reveal point moves.
   *
   * A feed is mutable state living outside React, so a component reads it through
   * `useSyncExternalStore` (see `useFeed`). A plain forced re-render would mostly
   * work and would also be wrong under concurrent rendering, which is the same
   * trap that made writing a ref during render illegal in `Chart.tsx`.
   */
  subscribe(listener: () => void): () => void;
};

export type FeedOptions = {
  /**
   * Bars revealed before the player acts, counted from `range.from`. Defaults to
   * the whole window, which is what every non-replay kind wants: a fully-revealed
   * feed behaves exactly like the slice it replaced.
   */
  primeBars?: number;
  /**
   * The last bar the feed may reveal. Defaults to `range.to - 1`.
   *
   * A replay level's window has to *contain* the outcome for the grader to score
   * it, so the level's `to` is not the reveal limit — `revealTo` is. That
   * separation is the whole reason a trade boss can be authored at all.
   */
  revealTo?: number;
};

/**
 * Builds a feed over a series window.
 *
 * `series` is captured here and never exposed. `visible()` results are memoised
 * per reveal point, so stepping through a replay does not re-slice on every
 * render — and stepping back to a bar already visited is free.
 */
export function createFeed(
  series: Series<string>,
  range: BarRange,
  options: FeedOptions = {},
): ReplayFeed {
  const length = series.t.length;
  const first = clamp(range.from, 0, Math.max(0, length - 1));
  const hardLast = clamp(range.to - 1, first, Math.max(0, length - 1));
  const last = clamp(options.revealTo ?? hardLast, first, hardLast);

  const primed =
    options.primeBars === undefined
      ? last
      : clamp(first + options.primeBars - 1, first, last);

  let at = primed;
  const memo = new Map<number, Series<string>>();
  const listeners = new Set<() => void>();

  function moveTo(next: number): void {
    const clamped = clamp(next, first, last);
    if (clamped === at) return;
    at = clamped;
    for (const listener of listeners) listener();
  }

  function visible(): Series<string> {
    const cached = memo.get(at);
    if (cached) return cached;
    const end = at + 1;
    const cut: Series<string> = {
      id: series.id,
      tf: series.tf,
      t: series.t.slice(0, end),
      o: series.o.slice(0, end),
      h: series.h.slice(0, end),
      l: series.l.slice(0, end),
      c: series.c.slice(0, end),
      v: series.v.slice(0, end),
    };
    memo.set(at, cut);
    return cut;
  }

  return {
    get at() {
      return at;
    },
    first,
    last,
    get done() {
      return at >= last;
    },
    visible,
    step(n = 1) {
      moveTo(at + Math.trunc(n));
    },
    seek(bar) {
      moveTo(Math.trunc(bar));
    },
    reset() {
      moveTo(primed);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** A feed with nothing withheld — what a kind that does not replay anything gets. */
export function fullyRevealed(
  series: Series<string>,
  range: BarRange,
): ReplayFeed {
  return createFeed(series, range);
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
