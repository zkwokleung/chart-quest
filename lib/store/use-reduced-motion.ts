"use client";

import { useSyncExternalStore } from "react";
import { useGameStore } from "./game";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(listener: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}

function systemPrefersReduced(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(QUERY).matches;
}

/**
 * Whether to avoid motion, from the player's setting or the OS.
 *
 * The stored setting is tri-state: `true` and `false` are an explicit choice, and
 * `"system"` defers to `prefers-reduced-motion`. An explicit choice wins, because
 * someone who turned animation back on inside the game meant it.
 *
 * Server-rendered as `false` — a media query has no answer without a window, and
 * `skipHydration` means the store's real value arrives on the client anyway.
 */
export function useReducedMotion(): boolean {
  const setting = useGameStore((s) => s.profile.settings.reducedMotion);
  // `subscribe` is module-scope and therefore already stable; wrapping it in
  // useCallback would add a hook to promise something it does not need.
  const system = useSyncExternalStore(
    subscribe,
    systemPrefersReduced,
    () => false,
  );
  return setting === "system" ? system : setting;
}
