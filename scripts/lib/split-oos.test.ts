import { describe, expect, it } from "vitest";
import type { HeldBackSeriesId, Series } from "../../lib/chart/types.ts";
import { HELD_BACK, OOS_FRACTION, oosIdFor, splitOos } from "./split-oos.ts";

const DAY = 86_400_000;

function daily(bars: number, id: HeldBackSeriesId = "SPY-1d"): Series<HeldBackSeriesId> {
  const t = Array.from({ length: bars }, (_, i) => Date.UTC(2005, 0, 1) + i * DAY);
  return {
    id,
    tf: "1d",
    t,
    o: t.map((_, i) => 100 + i),
    h: t.map((_, i) => 101 + i),
    l: t.map((_, i) => 99 + i),
    c: t.map((_, i) => 100.5 + i),
    v: t.map(() => 1000),
  };
}

describe("splitOos", () => {
  it("holds back the configured fraction from the end", () => {
    const { inSample, outOfSample } = splitOos(daily(5000));
    expect(outOfSample.t).toHaveLength(Math.floor(5000 * OOS_FRACTION));
    expect(inSample.t).toHaveLength(5000 - outOfSample.t.length);
  });

  it("produces halves that do not overlap", () => {
    // If a player had already practised on these bars, Chapter 10's validation
    // would prove nothing.
    const { inSample, outOfSample } = splitOos(daily(5000));
    const lastIn = inSample.t[inSample.t.length - 1] ?? 0;
    const firstOos = outOfSample.t[0] ?? 0;
    expect(firstOos).toBeGreaterThan(lastIn);
    expect(new Set(inSample.t).size + new Set(outOfSample.t).size).toBe(5000);
  });

  it("names the holdback with the -oos suffix", () => {
    expect(splitOos(daily(5000)).outOfSample.id).toBe("SPY-1d-oos");
    expect(oosIdFor("GC-1d")).toBe("GC-1d-oos");
  });

  it("keeps the in-sample id unchanged", () => {
    expect(splitOos(daily(5000)).inSample.id).toBe("SPY-1d");
  });

  it("refuses a holdback too short to validate against", () => {
    // 15% of 800 bars is 120 — far too few trades to say anything about a
    // strategy, so failing loudly beats shipping a meaningless check.
    expect(() => splitOos(daily(800))).toThrow(/too short/);
  });

  it("slices every column consistently", () => {
    const { inSample, outOfSample } = splitOos(daily(5000));
    for (const s of [inSample, outOfSample]) {
      const n = s.t.length;
      for (const key of ["o", "h", "l", "c", "v"] as const) {
        expect(s[key]).toHaveLength(n);
      }
    }
  });

  it("holds back every series except the 15m snapshot", () => {
    // Chapter 10 lets the player choose a timeframe. An unsplit series would let
    // them skip out-of-sample validation by picking it.
    expect(HELD_BACK).toContain("BTCUSDT-4h");
    expect(HELD_BACK).toContain("EURUSD-1h");
    expect(HELD_BACK).not.toContain("SPY-15m");
  });
});
