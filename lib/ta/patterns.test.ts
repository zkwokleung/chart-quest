import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Series } from "@/lib/chart/types";
import {
  DOJI_MAX_BODY,
  findAllPatterns,
  findPatterns,
  HEAD_MIN_PROMINENCE,
  PIN_MAX_BODY,
  PIN_MIN_WICK,
  PATTERN_KINDS,
  SWING_LOOKBACK,
} from "./patterns";
import { findSwings } from "./swings";

/**
 * Fixtures are hand-built, and each threshold gets a case that satisfies it and one
 * that misses by a hair.
 *
 * The near-misses are the point. A detector tested only on obvious examples will
 * happily fire on everything, and Chapter 4's base rates are computed from these
 * definitions — loosen the pin-bar body limit and every pin-bar win rate in the game
 * moves.
 */
type Bar = [o: number, h: number, l: number, c: number];

function build(bars: Bar[]): Series<string> {
  return {
    id: "FIXTURE-1d",
    tf: "1d",
    t: bars.map((_, i) => Date.UTC(2020, 0, i + 1)),
    o: bars.map((b) => b[0]),
    h: bars.map((b) => b[1]),
    l: bars.map((b) => b[2]),
    c: bars.map((b) => b[3]),
    v: bars.map(() => 1000),
  };
}

/**
 * Filler, so a fixture's interesting bar is the only interesting bar.
 *
 * Deliberately *not* flat: a bar with no body is a textbook doji and a run of
 * identical bars is a run of swing highs, so the obvious filler quietly plants
 * patterns of its own. This one has a body at 42% of its range — too fat for a doji
 * or a pin bar — and every copy is the same colour, so no two form an engulfing.
 */
function filler(n: number, price = 100): Bar[] {
  return Array.from({ length: n }, () => [
    price,
    price + 0.6,
    price - 0.6,
    price + 0.5,
  ]);
}

/**
 * Prices strictly between two waypoints, so no interior bar of a leg can tie the
 * peak it leads to and become a swing itself.
 */
function leg(from: number, to: number, steps: number): number[] {
  return Array.from(
    { length: steps },
    (_, i) => from + ((to - from) * (i + 1)) / (steps + 1),
  );
}

describe("pin bar", () => {
  it("finds a long lower wick with a small body", () => {
    // Range 10, body 2, lower wick 7 — comfortably inside both thresholds.
    const series = build([...filler(3), [109, 110, 100, 107], ...filler(3)]);
    const hits = findPatterns(series, "pin-bar");
    expect(hits).toHaveLength(1);
    expect(hits[0]?.bar).toBe(3);
    expect(hits[0]?.direction).toBe("bullish");
  });

  it("reads a long upper wick as bearish", () => {
    // The wick points at where price was rejected, so this one rejects highs.
    const series = build([...filler(3), [101, 110, 100, 103], ...filler(3)]);
    expect(findPatterns(series, "pin-bar")[0]?.direction).toBe("bearish");
  });

  it("rejects a bar whose body is a fraction over the limit", () => {
    // Range 10, so the body limit is 3.33. A body of 3.4 must miss.
    const series = build([...filler(3), [103.4, 110, 100, 100], ...filler(3)]);
    expect(findPatterns(series, "pin-bar")).toHaveLength(0);
    expect(PIN_MAX_BODY).toBeCloseTo(1 / 3);
  });

  it("rejects a small body with no long wick either side", () => {
    // Body 1 of range 10, but the wicks are 4.5 each — indecision, not rejection.
    const series = build([...filler(3), [104.5, 110, 100, 105.5], ...filler(3)]);
    expect(findPatterns(series, "pin-bar")).toHaveLength(0);
    expect(PIN_MIN_WICK).toBe(0.6);
  });

  it("ignores a bar with no range at all, rather than dividing by zero", () => {
    const series = build([...filler(3), [100, 100, 100, 100], ...filler(3)]);
    expect(findPatterns(series, "pin-bar")).toHaveLength(0);
    expect(findPatterns(series, "doji")).toHaveLength(0);
  });
});

describe("doji", () => {
  it("finds a body under a tenth of the range", () => {
    const series = build([...filler(3), [105, 110, 100, 105.5], ...filler(3)]);
    expect(findPatterns(series, "doji")).toHaveLength(1);
    expect(DOJI_MAX_BODY).toBe(0.1);
  });

  it("rejects a body just over it", () => {
    // Range 10, so the limit is 1.0. A body of 1.1 must miss.
    const series = build([...filler(3), [105, 110, 100, 106.1], ...filler(3)]);
    expect(findPatterns(series, "doji")).toHaveLength(0);
  });

  it("is stricter than a pin bar, so the two are not the same set", () => {
    // Body 2 of range 10 passes the pin-bar body limit but not the doji one; the
    // long lower wick makes this a pin bar and nothing else.
    const series = build([...filler(3), [109, 110, 100, 107], ...filler(3)]);
    expect(findPatterns(series, "pin-bar")).toHaveLength(1);
    expect(findPatterns(series, "doji")).toHaveLength(0);
  });
});

describe("engulfing", () => {
  it("finds a bullish body swallowing the previous bearish one", () => {
    const series = build([
      ...filler(3),
      [105, 105.5, 101, 101],
      [100, 107, 99.5, 106],
      ...filler(3),
    ]);
    const hits = findPatterns(series, "engulfing");
    expect(hits).toHaveLength(1);
    expect(hits[0]?.direction).toBe("bullish");
    // Two bars make this pattern, and 4.4's marks need to know that.
    expect(hits[0]?.components).toEqual([3, 4]);
  });

  it("requires the previous bar to be the opposite colour", () => {
    // Two greens in a row: the second is bigger, but there is nothing to engulf.
    const series = build([
      ...filler(3),
      [101, 103, 100.5, 102],
      [100, 107, 99.5, 106],
    ]);
    expect(findPatterns(series, "engulfing")).toHaveLength(0);
  });

  it("requires the body to be decisively larger, not merely larger", () => {
    // Previous body 4, this body 4.2 — a 5% increase, under the 10% required.
    const series = build([
      ...filler(3),
      [105, 105.5, 101, 101],
      [100.9, 106, 100.5, 105.1],
    ]);
    expect(findPatterns(series, "engulfing")).toHaveLength(0);
  });

  it("never fires on the first bar, which has nothing before it", () => {
    const series = build([[100, 107, 99, 106], ...filler(3)]);
    expect(findPatterns(series, "engulfing")).toHaveLength(0);
  });
});

/**
 * A path through waypoints, five bars of run-up and five of exit.
 *
 * The legs between waypoints are strictly monotone, so the waypoints are the only
 * swings the fixture contains and the detector is being asked about the shape that
 * was drawn rather than about noise.
 */
function shape(waypoints: number[]): { series: Series<string>; peaks: number[] } {
  const first = waypoints[0] ?? 0;
  const last = waypoints.at(-1) ?? 0;
  const prices = [...leg(first - 16, first, 5)];
  const peaks: number[] = [];
  for (const [i, point] of waypoints.entries()) {
    peaks.push(prices.length);
    prices.push(point);
    const next = waypoints[i + 1];
    if (next !== undefined) prices.push(...leg(point, next, 4));
  }
  prices.push(...leg(last, last - 16, 5));
  return {
    series: build(prices.map((p) => [p - 0.1, p + 0.2, p - 0.2, p + 0.1])),
    peaks,
  };
}

describe("double top", () => {
  const twinPeaks = (secondTop: number, troughDepth: number) =>
    shape([100, 100 - troughDepth, secondTop]);

  it("finds two level peaks separated by a real trough", () => {
    const { series, peaks } = twinPeaks(100, 8);
    const hits = findPatterns(series, "double-top");
    expect(hits).toHaveLength(1);
    expect(hits[0]?.direction).toBe("bearish");
    // Left top, trough, right top — the three parts 4.4 asks the player to mark.
    expect(hits[0]?.components).toEqual(peaks);
    expect(hits[0]?.bar).toBe(peaks[2]);
  });

  it("rejects peaks too far apart in price to be level", () => {
    // 100 and 95 differ by 5%, over the 2% tolerance.
    expect(findPatterns(twinPeaks(95, 8).series, "double-top")).toHaveLength(0);
  });

  it("rejects a shallow dip, which is one top with a wobble", () => {
    // A 1% trough against the 3% required. The dip is still a swing low — the
    // fixture fails on depth rather than on having no trough at all.
    const { series, peaks } = twinPeaks(100, 1);
    expect(findSwings(series, { from: 0, to: series.t.length }, 4)).toContainEqual(
      expect.objectContaining({ kind: "low", bar: peaks[1] }),
    );
    expect(findPatterns(series, "double-top")).toHaveLength(0);
  });
});

describe("head and shoulders", () => {
  const threePeaks = (left: number, head: number, right: number) => {
    const valley = Math.min(left, right) - 8;
    return shape([left, valley, head, valley, right]);
  };

  it("finds a head clear of two level shoulders", () => {
    const { series, peaks } = threePeaks(100, 110, 100);
    const hits = findPatterns(series, "head-and-shoulders");
    expect(hits).toHaveLength(1);
    // The three highs, not the valleys between them.
    expect(hits[0]?.components).toEqual([peaks[0], peaks[2], peaks[4]]);
  });

  it("rejects a head barely above its shoulders", () => {
    // 101 over 100 is 1%, under the 2% prominence required — that is three peaks of
    // roughly equal height, which is a range rather than a reversal pattern.
    const { series } = threePeaks(100, 101, 100);
    expect(findPatterns(series, "head-and-shoulders")).toHaveLength(0);
    expect(HEAD_MIN_PROMINENCE).toBe(0.02);
  });

  it("rejects shoulders at visibly different heights", () => {
    // 100 against 90 is 10%, well over the 4% tolerance.
    const { series } = threePeaks(100, 115, 90);
    expect(findPatterns(series, "head-and-shoulders")).toHaveLength(0);
  });
});

describe("against the committed data", () => {
  const load = (id: string) =>
    JSON.parse(readFileSync(`public/data/series/${id}.json`, "utf8")) as Series<string>;

  it("finds every kind on a real series, in plausible quantities", () => {
    // A detector that finds nothing is broken and one that fires on everything is
    // useless, so this pins both ends. The counts themselves are the subject of
    // base-rates.json rather than of this test.
    const spy = load("SPY-1d");
    for (const kind of PATTERN_KINDS) {
      const hits = findPatterns(spy, kind);
      expect(hits.length, `${kind} found none`).toBeGreaterThan(0);
      expect(hits.length / spy.t.length, `${kind} fires too often`).toBeLessThan(0.25);
    }
  });

  it("makes the chart patterns rare and the candle patterns common", () => {
    // The asymmetry 4.5 is built on: a doji has thousands of examples and a head and
    // shoulders has single digits, so their confidence intervals are worlds apart.
    const spy = load("SPY-1d");
    const doji = findPatterns(spy, "doji").length;
    const hs = findPatterns(spy, "head-and-shoulders").length;
    expect(doji).toBeGreaterThan(100);
    expect(hs).toBeLessThan(40);
  });

  it("reports components in time order, always", () => {
    const spy = load("SPY-1d");
    for (const hit of findAllPatterns(spy, { from: 0, to: 1200 })) {
      const sorted = [...hit.components].sort((a, b) => a - b);
      expect(hit.components, `${hit.kind} at ${hit.bar}`).toEqual(sorted);
      // And the completing bar is the last of them, since that is what a player clicks.
      expect(hit.components.at(-1)).toBe(hit.bar);
    }
  });

  it("charges chart patterns for the hindsight they are built on", () => {
    // The bug this field exists to prevent. A double top's second peak is not a swing
    // high until four bars have failed to exceed it, and those four bars are exactly
    // the ones where price falls away from the top — so measuring the forward return
    // from `bar` credited the pattern with a 73% win rate and +1.36 ATR. From
    // `confirmedAt` it is a coin flip. A candle owes nothing: it is a fact at its own
    // close.
    const spy = load("SPY-1d");
    for (const hit of findPatterns(spy, "double-top")) {
      expect(hit.confirmedAt).toBe(hit.bar + SWING_LOOKBACK);
    }
    for (const hit of findPatterns(spy, "head-and-shoulders")) {
      expect(hit.confirmedAt).toBe(hit.bar + SWING_LOOKBACK);
    }
    for (const kind of ["pin-bar", "doji", "engulfing"] as const) {
      for (const hit of findPatterns(spy, kind)) {
        expect(hit.confirmedAt).toBe(hit.bar);
      }
    }
  });

  it("never confirms a pattern before its last component", () => {
    const spy = load("SPY-1d");
    for (const hit of findAllPatterns(spy, { from: 0, to: 1200 })) {
      expect(hit.confirmedAt).toBeGreaterThanOrEqual(hit.components.at(-1)!);
    }
  });

  it("respects a range, so a level's window bounds what it finds", () => {
    const spy = load("SPY-1d");
    for (const hit of findPatterns(spy, "pin-bar", { from: 500, to: 600 })) {
      expect(hit.bar).toBeGreaterThanOrEqual(500);
      expect(hit.bar).toBeLessThan(600);
    }
  });
});
