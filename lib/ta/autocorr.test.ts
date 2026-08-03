import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Series } from "@/lib/chart/types";
import {
  autocorrelation,
  compact,
  crossingHorizon,
  logReturns,
  noiseBand,
  varianceRatio,
  varianceRatioCurve,
} from "./autocorr";

/**
 * The estimator has to be right before any level quotes it, and "right" here cannot be
 * checked by eye — a variance ratio is a number nobody has an intuition for. So the tests
 * are of three kinds: exact identities that hold for any input, synthetic series whose
 * answer is known by construction, and regression fixtures pinning the six committed
 * assets. The last of those is issue #26's gate stated as a test.
 */

/** A seeded LCG, so "random" inputs are identical on every run. */
function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** Box–Muller over the seeded stream. */
function normals(n: number, seed: number): number[] {
  const random = lcg(seed);
  const out: number[] = [];
  while (out.length < n) {
    const u = Math.max(random(), 1e-12);
    const v = random();
    out.push(Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v));
  }
  return out;
}

const cache = new Map<string, Series<string>>();
function series(id: string): Series<string> {
  const hit = cache.get(id);
  if (hit) return hit;
  const loaded = JSON.parse(
    readFileSync(join("public/data/series", `${id}.json`), "utf8"),
  ) as Series<string>;
  cache.set(id, loaded);
  return loaded;
}

describe("log returns", () => {
  it("sums to the total log move, which is the property variance ratios need", () => {
    // The reason the module uses log rather than simple returns: only these sum. A variance
    // ratio is the variance of a *sum* over the variance of one term, so with simple returns
    // the statistic would not be the ratio it claims to be.
    const s = series("SPY-1d");
    const r = compact(logReturns(s, { from: 1, to: 500 }));
    const total = r.reduce((t, x) => t + x, 0);
    expect(total).toBeCloseTo(Math.log(s.c[500]! / s.c[0]!), 10);
  });

  it("returns a hole rather than a number where a close is missing", () => {
    const broken = { ...series("SPY-1d"), c: [...series("SPY-1d").c] };
    broken.c[10] = 0;
    const r = logReturns(broken, { from: 8, to: 13 });
    // Both the return into bar 10 and the one out of it are unformable.
    expect(r[2]).toBeNull();
    expect(r[3]).toBeNull();
    expect(compact(r)).toHaveLength(4);
  });
});

describe("variance ratio", () => {
  it("is exactly 1 at q=1, for any input", () => {
    // By construction rather than by arithmetic: a level's reference answer must not depend
    // on floating point deciding whether a variance equals itself.
    for (const seed of [1, 7, 99]) {
      const point = varianceRatio(normals(400, seed), 1)!;
      expect(point.vr).toBe(1);
      expect(point.z).toBe(0);
    }
  });

  it("satisfies vr(2) − 1 ≈ rho(1) on every committed series", () => {
    // The cheapest available check that the estimator is not subtly wrong. The identity is
    // a property of the definitions, so it holds regardless of what the market did — which
    // is exactly what makes it catch a mistake no hand-built fixture would.
    for (const id of [
      "BTCUSDT-1d",
      "SPY-1d",
      "AAPL-1d",
      "EURUSD-1d",
      "GC-1d",
      "LAKE-1d",
    ]) {
      const r = compact(logReturns(series(id)));
      const rho = autocorrelation(r, 1)!;
      const vr2 = varianceRatio(r, 2)!.vr;
      expect(Math.abs(vr2 - 1 - rho), `${id}`).toBeLessThan(0.02);
    }
  });

  it("reads about 1 on a random walk, and says so with its z", () => {
    const point = varianceRatio(normals(3000, 42), 10)!;
    expect(point.vr).toBeGreaterThan(0.85);
    expect(point.vr).toBeLessThan(1.15);
    expect(Math.abs(point.z)).toBeLessThan(2);
  });

  it("reads above 1 on a series built to trend", () => {
    // AR(1) with positive rho: each move inherits part of the last one.
    const shocks = normals(3000, 11);
    const r: number[] = [];
    let previous = 0;
    for (const shock of shocks) {
      previous = 0.3 * previous + shock;
      r.push(previous);
    }
    expect(varianceRatio(r, 2)!.vr).toBeGreaterThan(1.2);
  });

  it("reads below 1 on a series built to reverse", () => {
    // AR(1) with negative rho. Alternating the *sign* of independent shocks does not work
    // and is worth naming: flipping i.i.d. draws leaves them i.i.d., so that series has no
    // autocorrelation at all and reads 1.0. Reversion has to be built into the process.
    const shocks = normals(3000, 13);
    const r: number[] = [];
    let previous = 0;
    for (const shock of shocks) {
      previous = -0.3 * previous + shock;
      r.push(previous);
    }
    expect(varianceRatio(r, 2)!.vr).toBeLessThan(0.85);
  });

  it("refuses a sample too small to support the horizon", () => {
    expect(varianceRatio(normals(20, 3), 2)).toBeNull();
    expect(varianceRatio(normals(50, 3), 60)).toBeNull();
    expect(varianceRatio(normals(400, 3), 0)).toBeNull();
  });

  it("uses overlapping windows, or q=60 would rest on two dozen observations", () => {
    // A non-overlapping estimator over 1,433 bars leaves 23 windows at q=60. This asserts the
    // sample the module actually reports, which is the whole series.
    const r = compact(logReturns(series("SPY-1d")));
    expect(varianceRatio(r, 60)!.n).toBe(r.length);
  });
});

describe("the robust z, which is what stops the chapter overclaiming", () => {
  it("finds the index's short-horizon reversion significant", () => {
    // The one effect in the whole spine that survives a heteroskedasticity-robust test.
    const r = compact(logReturns(series("SPY-1d")));
    expect(varianceRatio(r, 2)!.z).toBeLessThan(-2);
  });

  it("does not find Bitcoin's persistence significant at any horizon", () => {
    // The finding that reshaped levels 8.2 and 8.3. Bitcoin's VR climbs to 1.41 by 90 bars
    // and that looks emphatic, but volatility clustering explains most of it: no horizon
    // clears |z| = 2. The chapter teaches this rather than the point estimates alone.
    const r = compact(logReturns(series("BTCUSDT-1d")));
    for (const q of [2, 5, 10, 20, 40, 60, 90]) {
      expect(Math.abs(varianceRatio(r, q)!.z), `q=${q}`).toBeLessThan(2);
    }
    // And the point estimate really does climb, which is why the z column has to be shown.
    expect(varianceRatio(r, 90)!.vr).toBeGreaterThan(1.3);
  });
});

describe("the committed spine, pinned", () => {
  // Issue #26's gate: "8.2 reproduces known per-asset persistence figures." Measured over
  // each asset's own consecutive bars — including Bitcoin's weekends, since dropping them
  // would change what a one-day return means for Bitcoin.
  const EXPECTED: Record<string, { rho1: number; vr2: number; vr90: number }> = {
    "BTCUSDT-1d": { rho1: -0.052, vr2: 0.949, vr90: 1.41 },
    "SPY-1d": { rho1: -0.106, vr2: 0.894, vr90: 0.67 },
    "AAPL-1d": { rho1: -0.029, vr2: 0.971, vr90: 1.09 },
    "EURUSD-1d": { rho1: -0.189, vr2: 0.81, vr90: 0.66 },
    "GC-1d": { rho1: 0.0, vr2: 1.0, vr90: 0.77 },
    "LAKE-1d": { rho1: -0.08, vr2: 0.92, vr90: 0.58 },
  };

  it.each(Object.entries(EXPECTED))("%s", (id, expected) => {
    const r = compact(logReturns(series(id)));
    expect(autocorrelation(r, 1)!).toBeCloseTo(expected.rho1, 2);
    expect(varianceRatio(r, 2)!.vr).toBeCloseTo(expected.vr2, 2);
    expect(varianceRatio(r, 90)!.vr).toBeCloseTo(expected.vr90, 1);
  });

  it("puts only Bitcoin above 1 at a long horizon", () => {
    // The separation 8.3 asks the player to rank, before the z column complicates it.
    const above = Object.keys(EXPECTED).filter(
      (id) => varianceRatio(compact(logReturns(series(id))), 90)!.vr > 1,
    );
    expect(above).toEqual(["BTCUSDT-1d", "AAPL-1d"]);
  });
});

describe("crossing horizon", () => {
  it("interpolates between grid points rather than snapping to one", () => {
    const curve = [
      { q: 5, vr: 0.9, z: 0, n: 100 },
      { q: 15, vr: 1.1, z: 0, n: 100 },
    ];
    expect(crossingHorizon(curve)).toBeCloseTo(10, 6);
  });

  it("returns null when a curve never crosses", () => {
    const r = compact(logReturns(series("SPY-1d")));
    const curve = varianceRatioCurve(r, [2, 5, 10, 20, 60, 90]);
    expect(crossingHorizon(curve)).toBeNull();
  });

  it("finds Bitcoin's crossing in the single-digit days", () => {
    // 8.2's answer. The player starts at q=2 watching crypto mean-revert and drags right.
    const r = compact(logReturns(series("BTCUSDT-1d")));
    const curve = varianceRatioCurve(
      r,
      Array.from({ length: 89 }, (_, i) => i + 2),
    );
    const crossing = crossingHorizon(curve)!;
    expect(crossing).toBeGreaterThan(3);
    expect(crossing).toBeLessThan(12);
  });
});

describe("noise band", () => {
  it("shrinks with the sample", () => {
    expect(noiseBand(100)).toBeCloseTo(0.196, 3);
    expect(noiseBand(10000)).toBeCloseTo(0.0196, 4);
    expect(noiseBand(0)).toBe(Infinity);
  });
});
