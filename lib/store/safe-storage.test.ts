import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isUsingMemoryFallback,
  resetSafeStorageForTests,
  safeStorage,
} from "./safe-storage";

function installStorage(impl: Partial<Storage>): void {
  vi.stubGlobal("localStorage", {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
    clear: () => undefined,
    key: () => null,
    length: 0,
    ...impl,
  } satisfies Storage);
}

describe("safeStorage", () => {
  beforeEach(() => {
    resetSafeStorageForTests();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("round-trips through a working localStorage", () => {
    const backing = new Map<string, string>();
    installStorage({
      getItem: (k) => backing.get(k) ?? null,
      setItem: (k, v) => void backing.set(k, v),
      removeItem: (k) => void backing.delete(k),
    });

    safeStorage.setItem("chart-quest", '{"xp":1}');
    expect(safeStorage.getItem("chart-quest")).toBe('{"xp":1}');
    expect(isUsingMemoryFallback()).toBe(false);
  });

  it("keeps the session usable when writes throw on quota", () => {
    installStorage({
      setItem: () => {
        throw new DOMException("quota", "QuotaExceededError");
      },
    });

    expect(() => safeStorage.setItem("chart-quest", "x")).not.toThrow();
    expect(isUsingMemoryFallback()).toBe(true);
    // The write still has to be readable in-session, or progress vanishes
    // between screens rather than merely failing to survive a reload.
    expect(safeStorage.getItem("chart-quest")).toBe("x");
  });

  it("falls back when reads throw, as in private browsing", () => {
    installStorage({
      getItem: () => {
        throw new DOMException("denied", "SecurityError");
      },
    });

    expect(safeStorage.getItem("chart-quest")).toBeNull();
    expect(isUsingMemoryFallback()).toBe(true);
  });

  it("works when localStorage is absent entirely", () => {
    vi.stubGlobal("localStorage", undefined);

    expect(() => safeStorage.setItem("chart-quest", "y")).not.toThrow();
    expect(safeStorage.getItem("chart-quest")).toBe("y");
  });

  it("warns exactly once no matter how many writes fail", () => {
    installStorage({
      setItem: () => {
        throw new DOMException("quota", "QuotaExceededError");
      },
    });

    for (let i = 0; i < 25; i += 1) safeStorage.setItem("chart-quest", `${i}`);

    // A warning per write would flood the console on every state change.
    expect(console.warn).toHaveBeenCalledTimes(1);
  });
});
