"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { Series } from "@/lib/chart/types";
import type { ReplayFeed } from "./feed";

export type FeedView = {
  /** Absolute index of the last revealed bar. */
  at: number;
  /** The revealed bars. Re-read on every reveal, memoised inside the feed. */
  series: Series<string>;
  done: boolean;
};

/**
 * Subscribes a component to a feed's reveal point.
 *
 * A feed is mutable state outside React, so this goes through
 * `useSyncExternalStore` rather than a forced re-render: it is the API that stays
 * correct when React renders concurrently, and `Chart.tsx` already paid for
 * learning that lesson the other way round.
 *
 * `series` comes straight from `feed.visible()`, which memoises per reveal point,
 * so this returns a stable object between reveals and does not re-slice on every
 * render.
 */
export function useFeed(feed: ReplayFeed): FeedView {
  const subscribe = useCallback(
    (listener: () => void) => feed.subscribe(listener),
    [feed],
  );
  const at = useSyncExternalStore(
    subscribe,
    () => feed.at,
    () => feed.at,
  );
  return { at, series: feed.visible(), done: feed.done };
}
