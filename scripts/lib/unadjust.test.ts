import { describe, expect, it } from "vitest";
import type { Series } from "../../lib/chart/types.ts";
import type { SplitEvent } from "../sources/yahoo.ts";
import { unadjustSplits } from "./unadjust.ts";

const DAY = 86_400_000;
const SPLIT_MS = Date.UTC(2020, 7, 31);

function series(closes: number[], startMs = Date.UTC(2020, 7, 26)): Series<string> {
  return {
    id: "TEST-1d",
    tf: "1d",
    t: closes.map((_, i) => startMs + i * DAY),
    o: closes.map((c) => c),
    h: closes.map((c) => c + 1),
    l: closes.map((c) => c - 1),
    c: [...closes],
    v: closes.map(() => 1000),
  };
}

describe("unadjustSplits", () => {
  it("returns the series untouched when there are no splits", () => {
    const input = series([100, 101, 102]);
    expect(unadjustSplits(input, []).c).toEqual([100, 101, 102]);
  });

  it("scales bars before a split and leaves later bars alone", () => {
    // 2020-08-26, 08-27, ... 08-31 is index 5.
    const input = series([124, 125, 124.81, 129.04, 134.18, 131.4]);
    const splits: SplitEvent[] = [{ atMs: SPLIT_MS, ratio: 4 }];
    const out = unadjustSplits(input, splits);

    const splitIndex = input.t.findIndex((t) => t >= SPLIT_MS);
    expect(splitIndex).toBeGreaterThan(0);

    for (let i = 0; i < splitIndex; i += 1) {
      expect(out.c[i]).toBeCloseTo((input.c[i] ?? 0) * 4, 2);
    }
    for (let i = splitIndex; i < input.t.length; i += 1) {
      expect(out.c[i]).toBeCloseTo(input.c[i] ?? 0, 2);
    }
  });

  it("manufactures the phantom crash level 1.7 depends on", () => {
    // Real AAPL adjusted closes on the two sessions either side of the split.
    // The dates are explicit because the split fell after a weekend — Friday
    // 08-28 to Monday 08-31 — and consecutive-day fixtures would put both bars
    // on the same side of it.
    const input: Series<string> = {
      id: "AAPL-1d",
      tf: "1d",
      t: [Date.UTC(2020, 7, 28), Date.UTC(2020, 7, 31)],
      o: [124.5, 128.0],
      h: [125.5, 130.0],
      l: [124.0, 127.5],
      c: [124.81, 129.04],
      v: [1000, 2000],
    };
    const out = unadjustSplits(input, [{ atMs: SPLIT_MS, ratio: 4 }]);

    const before = out.c[0] ?? 0;
    const after = out.c[1] ?? 0;
    expect(before).toBeCloseTo(499.24, 1);
    expect(after).toBeCloseTo(129.04, 1);

    const drop = after / before - 1;
    expect(drop).toBeLessThan(-0.7);

    // The adjusted series shows the same two days as a small gain. Both readings
    // come from the same trades — which is the entire lesson.
    const truth = (input.c[1] ?? 0) / (input.c[0] ?? 1) - 1;
    expect(truth).toBeGreaterThan(0);
  });

  it("compounds multiple splits", () => {
    const early = Date.UTC(2014, 5, 9); // 7:1
    const late = SPLIT_MS; // 4:1
    const input = series([1, 1, 1], Date.UTC(2010, 0, 1));
    const out = unadjustSplits(input, [
      { atMs: early, ratio: 7 },
      { atMs: late, ratio: 4 },
    ]);
    // A 2010 bar predates both, so it carries the product of the two ratios.
    expect(out.c[0]).toBeCloseTo(28, 5);
  });

  it("keeps every bar internally consistent after scaling", () => {
    const input = series([124.81, 129.04, 134.18]);
    const out = unadjustSplits(input, [{ atMs: SPLIT_MS, ratio: 4 }]);
    for (let i = 0; i < out.t.length; i += 1) {
      const h = out.h[i] ?? 0;
      const l = out.l[i] ?? 0;
      const o = out.o[i] ?? 0;
      const c = out.c[i] ?? 0;
      expect(h).toBeGreaterThanOrEqual(Math.max(o, c));
      expect(l).toBeLessThanOrEqual(Math.min(o, c));
    }
  });

  it("does not rescale volume", () => {
    const input = series([100, 200]);
    const out = unadjustSplits(input, [{ atMs: SPLIT_MS, ratio: 4 }]);
    expect(out.v).toEqual(input.v);
  });
});
