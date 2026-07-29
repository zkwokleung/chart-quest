"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "./game";

/**
 * Rehydrates the persisted store after mount and reports when it is safe to
 * read progress.
 *
 * The store sets `skipHydration`, so anything rendered before this resolves sees
 * the initial state. Components must render a neutral placeholder until it does
 * — reading progress during the first paint produces markup the server could not
 * have produced, which surfaces as a hydration error in production only.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void useGameStore.persist.rehydrate()?.then(() => {
      if (!cancelled) setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return hydrated;
}
