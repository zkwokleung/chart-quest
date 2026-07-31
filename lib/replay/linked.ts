import type { Series, Timeframe } from "@/lib/chart/types";
import type { ReplayFeed } from "./feed";

/**
 * Two timeframes advancing together, from one transport.
 *
 * Chapter 6's multi-timeframe levels show a higher timeframe for bias beside a lower one
 * for entry, and 6.2 and 6.B run both panes through a replay. A 4h bar and a 1d bar do
 * not tick at the same time, so something has to decide when the slower pane moves.
 *
 * **The low timeframe drives and the high timeframe is derived.** The follower's reveal
 * point is computed from the driver's current moment rather than counted alongside it, so
 * there is no second clock and drift is not representable — a scrub, a reset or a step of
 * seven bars all land the follower in the same place as an equivalent sequence of single
 * steps.
 *
 * ## The trap
 *
 * The obvious rule — reveal the follower bar containing the driver's current timestamp —
 * **leaks the future**. A 4h bar whose open is an hour behind the driver still closes
 * three hours ahead of it, and revealing it hands the player a close that has not
 * happened. It would look entirely correct on screen.
 *
 * So a follower bar is revealed only once its whole window has elapsed. The higher pane
 * therefore lags by up to one of its own bars, which is not a defect: the 4h bar genuinely
 * is not finished yet. Showing it forming would mean rebuilding it from the driver's
 * revealed bars on every step, which is a different feature and one no level asks for.
 */

const NOMINAL_MS: Record<Timeframe, number> = {
  "15m": 900_000,
  "1h": 3_600_000,
  "4h": 14_400_000,
  "1d": 86_400_000,
};

/**
 * When the bar at `index` finishes.
 *
 * Taken from the *next* bar's open where there is one, which is exact whatever session
 * convention the instrument follows — an equity day ends when the next one begins, and no
 * per-instrument rule is needed to know that. The nominal duration is only a fallback for
 * the final bar, which has no successor to ask.
 */
export function barEnd(series: Series<string>, index: number): number {
  const start = series.t[index];
  if (start === undefined) return -Infinity;
  return series.t[index + 1] ?? start + NOMINAL_MS[series.tf];
}

/**
 * The last bar whose window has closed by `atMs`, or -1 if none has.
 *
 * Binary search: `t` is ascending, and a linked feed asks this on every step of a replay
 * that may run to hundreds of bars.
 */
export function lastClosedBar(series: Series<string>, atMs: number): number {
  let low = 0;
  let high = series.t.length - 1;
  let answer = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (barEnd(series, mid) <= atMs) {
      answer = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return answer;
}

/** The bar containing a moment, or -1 when the moment precedes the series. */
export function barContaining(series: Series<string>, atMs: number): number {
  let low = 0;
  let high = series.t.length - 1;
  let answer = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if ((series.t[mid] ?? Infinity) <= atMs) {
      answer = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return answer;
}

export type FollowerSpec = {
  /** The higher-timeframe series. Captured in a closure, never exposed. */
  series: Series<string>;
  /** First bar of the follower's window. */
  from: number;
  /** Last bar the follower may ever reveal, inclusive. */
  to: number;
};

/**
 * A `ReplayFeed` over the follower, positioned by the driver.
 *
 * Returns the same shape `createFeed` does — `visible()`, `subscribe`, `at`, `first`,
 * `last`, `done` — so `FeedChart` and every existing kind consume it without knowing it is
 * linked. That is what keeps the multi-timeframe levels from needing their own components.
 *
 * The transport delegates rather than no-ops. A silent `step` that did nothing would be a
 * trap for whoever wires the next MTF level, and the mapping back to the driver already
 * exists in the timestamps.
 */
export function linkFeeds(driver: ReplayFeed, follower: FollowerSpec): ReplayFeed {
  const { series, from, to } = follower;
  const last = Math.min(to, series.t.length - 1);
  const memo = new Map<number, Series<string>>();

  /** Driver bars per follower bar. Exact for every pair Chapter 6 uses. */
  const ratio = Math.max(
    1,
    Math.round(NOMINAL_MS[series.tf] / NOMINAL_MS[driver.visible().tf]),
  );

  /** Where the driver has actually got to: the end of the bar it is showing. */
  const driverMoment = () => barEnd(driver.visible(), driver.at);

  /**
   * **No floor at `from`.** An earlier draft clamped upward so the pane would never look
   * empty, and that was the leak this module is about: if the driver's window opens
   * part-way through follower bar `from`, that bar is still forming, and showing it hands
   * over a close that has not happened. The leak test caught it on all three pairs.
   *
   * So the position may sit below `from`, which simply means the higher pane has not
   * completed a bar inside its window yet. Choosing a `from` that has already closed at
   * the driver's start is the caller's business, not this function's — `visible()` slices
   * from zero either way, exactly as `createFeed` does, so nothing renders wrongly.
   */
  const positionFor = (moment: number) => Math.min(last, lastClosedBar(series, moment));

  const at = () => positionFor(driverMoment());

  function visible(): Series<string> {
    const end = at() + 1;
    const cached = memo.get(end);
    if (cached) return cached;
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
    memo.set(end, cut);
    return cut;
  }

  return {
    get at() {
      return at();
    },
    first: from,
    last,
    get done() {
      return at() >= last;
    },
    visible,
    /**
     * `n` *follower* bars, as `n * ratio` driver bars.
     *
     * Relative motion rather than an absolute seek, and deliberately: translating a target
     * follower bar into a driver *index* would need the driver's full timeline, and the
     * only timeline a linked feed can see is `driver.visible()` — truncated at the reveal
     * point, so it cannot address a bar ahead of it. Which is the seal working as intended.
     * A ratio needs no timeline at all, and is exact because every pair this is used with
     * is an exact multiple.
     */
    step(n = 1) {
      driver.step(Math.trunc(n) * ratio);
    },
    seek(bar) {
      const target = Math.min(last, Math.max(from, Math.trunc(bar)));
      driver.step((target - at()) * ratio);
    },
    reset() {
      driver.reset();
    },
    subscribe(listener) {
      return driver.subscribe(listener);
    },
  };
}
