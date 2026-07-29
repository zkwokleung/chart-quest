import type { StateStorage } from "zustand/middleware";

/**
 * Storage that never throws.
 *
 * Progress is the player's only copy — there is no account to fall back on — so
 * a storage failure must degrade rather than crash. Private-browsing mode makes
 * `localStorage` present but throwing, and a full quota throws on write only, so
 * both reads and writes need guarding independently.
 */

const memory = new Map<string, string>();

let usingMemoryFallback = false;
let warned = false;

function warnOnce(reason: unknown): void {
  usingMemoryFallback = true;
  if (warned) return;
  warned = true;
  console.warn(
    "[chart-quest] Progress cannot be saved in this browser, so it will be lost when the tab closes. " +
      "Private browsing or a full storage quota is the usual cause.",
    reason,
  );
}

function backing(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch (err) {
    // Accessing the property itself throws under some privacy settings.
    warnOnce(err);
    return null;
  }
}

export const safeStorage: StateStorage = {
  getItem(name) {
    // Once a write has failed, localStorage no longer holds the current value —
    // memory does. Reading the store first here would drop state between
    // screens, which is worse than simply not surviving a reload.
    if (usingMemoryFallback && memory.has(name)) {
      return memory.get(name) ?? null;
    }
    const store = backing();
    if (!store) return memory.get(name) ?? null;
    try {
      return store.getItem(name) ?? memory.get(name) ?? null;
    } catch (err) {
      warnOnce(err);
      return memory.get(name) ?? null;
    }
  },

  setItem(name, value) {
    memory.set(name, value);
    const store = backing();
    if (!store) return;
    try {
      store.setItem(name, value);
    } catch (err) {
      warnOnce(err);
    }
  },

  removeItem(name) {
    memory.delete(name);
    const store = backing();
    if (!store) return;
    try {
      store.removeItem(name);
    } catch (err) {
      warnOnce(err);
    }
  },
};

export function isUsingMemoryFallback(): boolean {
  return usingMemoryFallback;
}

/** Test-only: the fallback flags are module state and would otherwise leak between cases. */
export function resetSafeStorageForTests(): void {
  memory.clear();
  usingMemoryFallback = false;
  warned = false;
}
