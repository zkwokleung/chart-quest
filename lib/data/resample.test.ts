import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Series, Timeframe } from "@/lib/chart/types";
import { barsPerBucket, resample, type Bucket } from "./resample";

/**
 * The headline case is a proof rather than a fixture.
 *
 * `BTCUSDT-4h` and `BTCUSDT-1d` are both committed, both fetched from Binance, and both
 * describe the same 931 days. Resampling one into the other has a right answer that
 * nobody here wrote down, so if the arithmetic or the boundary rule is wrong this test
 * says so — unlike a hand-built fixture, which can only confirm that the code does what
 * its author thought it did.
 */

function load(id: string): Series<string> {
  return JSON.parse(
    readFileSync(`public/data/series/${id}.json`, "utf8"),
  ) as Series<string>;
}

const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);

describe("resampling BTCUSDT-4h into days reproduces the committed daily series", () => {
  const source = load("BTCUSDT-4h");
  const real = load("BTCUSDT-1d");
  const derived = resample(source, "1d", "BTCUSDT-1d");
  const realByDay = new Map(real.t.map((t, i) => [day(t), i]));

  const pairs = derived.t
    .map((t, i) => ({ derivedIndex: i, realIndex: realByDay.get(day(t)), when: day(t) }))
    .filter((p): p is { derivedIndex: number; realIndex: number; when: string } =>
      p.realIndex !== undefined,
    );

  it("covers the whole overlap, which is what makes this worth asserting", () => {
    // 5,586 four-hour bars is 931 whole days. If this ever drops sharply, the boundary
    // rule changed and the identity below is passing on a handful of bars.
    expect(pairs.length).toBeGreaterThan(900);
  });

  it("matches open, high, low and close on every one of them", () => {
    const near = (a: number, b: number) =>
      Math.abs(a - b) / Math.max(1e-9, Math.abs(b)) < 1e-6;
    const wrong = pairs.filter(
      ({ derivedIndex: d, realIndex: r }) =>
        !near(derived.o[d]!, real.o[r]!) ||
        !near(derived.h[d]!, real.h[r]!) ||
        !near(derived.l[d]!, real.l[r]!) ||
        !near(derived.c[d]!, real.c[r]!),
    );
    expect(
      wrong.map((w) => w.when),
      "days where the derived daily bar disagrees with the committed one",
    ).toEqual([]);
  });

  it("matches volume to within the rounding the committed data already applied", () => {
    // Not exact, and it cannot be. `scripts/lib/columnar.ts` rounds each bar's volume to
    // a whole unit at fetch time, so the daily figure is one rounding of the day's total
    // while the six 4h figures are six roundings summed — and sum-of-rounded is not
    // round-of-sum. Six bars at up to half a unit each bounds the gap at 3.
    //
    // Worth asserting anyway rather than dropping: the observed gap is 0-2 units against
    // volumes near 130,000, so a real fault here — the wrong field, a double-count, a
    // missed bar — would miss by thousands and still fail.
    const budget = 6 / 2;
    const off = pairs
      .map((p) => ({ ...p, gap: Math.abs(derived.v[p.derivedIndex]! - real.v[p.realIndex]!) }))
      .filter((p) => p.gap > budget);
    expect(off.map((o) => `${o.when} off by ${o.gap}`)).toEqual([]);
  });

  it("labels the result with the timeframe it produced", () => {
    expect(derived.tf).toBe("1d");
  });
});

describe("whole buckets only", () => {
  function build(tf: Timeframe, bars: [ms: number, o: number, h: number, l: number, c: number, v: number][]): Series<string> {
    return {
      id: `FIXTURE-${tf}`,
      tf,
      t: bars.map((b) => b[0]),
      o: bars.map((b) => b[1]),
      h: bars.map((b) => b[2]),
      l: bars.map((b) => b[3]),
      c: bars.map((b) => b[4]),
      v: bars.map((b) => b[5]),
    };
  }

  const H = 3_600_000;
  /** Four whole hours of 15m bars, then a fifth hour with only two. */
  const fifteens = build(
    "15m",
    Array.from({ length: 18 }, (_, i) => {
      const price = 100 + i;
      return [Date.UTC(2024, 0, 1) + i * 900_000, price, price + 2, price - 2, price + 1, 10] as
        [number, number, number, number, number, number];
    }),
  );

  it("emits a bar for each whole bucket and drops the short one", () => {
    // 18 fifteen-minute bars is four whole hours plus two leftover bars.
    const hourly = resample(fifteens, "1h");
    expect(hourly.t).toHaveLength(4);
    expect(hourly.v).toEqual([40, 40, 40, 40]);
  });

  it("takes the first open, the last close, and the extremes between", () => {
    const hourly = resample(fifteens, "1h");
    // First hour is bars 0-3: prices 100..103, so open 100, close 104, high 105, low 98.
    expect(hourly.o[0]).toBe(100);
    expect(hourly.c[0]).toBe(104);
    expect(hourly.h[0]).toBe(105);
    expect(hourly.l[0]).toBe(98);
  });

  it("stamps each bar with the start of its bucket", () => {
    const hourly = resample(fifteens, "1h");
    expect(hourly.t[0]).toBe(Date.UTC(2024, 0, 1));
    expect(hourly.t[1]).toBe(Date.UTC(2024, 0, 1) + H);
  });

  it("drops a bucket with a gap in the middle, not only at the ends", () => {
    // Three of the four bars in the second hour, so that hour is not whole even though
    // whole hours sit either side of it.
    const gapped = build("15m", [
      ...([0, 1, 2, 3].map((i) => [Date.UTC(2024, 0, 1) + i * 900_000, 100, 101, 99, 100, 5] as [number, number, number, number, number, number])),
      ...([0, 1, 2].map((i) => [Date.UTC(2024, 0, 1) + H + i * 900_000, 100, 101, 99, 100, 5] as [number, number, number, number, number, number])),
      ...([0, 1, 2, 3].map((i) => [Date.UTC(2024, 0, 1) + 2 * H + i * 900_000, 100, 101, 99, 100, 5] as [number, number, number, number, number, number])),
    ]);
    const hourly = resample(gapped, "1h");
    expect(hourly.t).toEqual([Date.UTC(2024, 0, 1), Date.UTC(2024, 0, 1) + 2 * H]);
  });

  it("aligns 4h blocks to UTC midnight", () => {
    const hours = build(
      "1h",
      Array.from({ length: 8 }, (_, i) => [
        Date.UTC(2024, 0, 1, 2) + i * H,
        100,
        101,
        99,
        100,
        1,
      ] as [number, number, number, number, number, number]),
    );
    // Starting at 02:00: 02-03 is a partial 00-04 block and drops; 04-08 is whole.
    const blocks = resample(hours, "4h");
    expect(blocks.t).toEqual([Date.UTC(2024, 0, 1, 4)]);
  });
});

describe("valid pairings", () => {
  it("knows how many source bars make a bucket", () => {
    expect(barsPerBucket("4h", "1d")).toBe(6);
    expect(barsPerBucket("1h", "1d")).toBe(24);
    expect(barsPerBucket("1h", "4h")).toBe(4);
    expect(barsPerBucket("15m", "1h")).toBe(4);
    expect(barsPerBucket("15m", "1d")).toBe(96);
  });

  it("refuses a target that is not strictly coarser", () => {
    const daily = load("GC-1d");
    for (const into of ["1h", "4h", "1d"] as Bucket[]) {
      expect(() => resample(daily, into), `1d into ${into}`).toThrow(/strictly coarser/);
    }
    expect(() => resample(load("EURUSD-1h"), "1h")).toThrow(/strictly coarser/);
  });
});

describe("against the committed intraday series", () => {
  const cases: [id: string, into: Bucket][] = [
    ["EURUSD-1h", "4h"],
    ["SPY-15m", "1h"],
  ];

  it.each(cases)("%s into %s contains every source bar's range", (id, into) => {
    // The property that catches a mis-assigned bucket: an aggregate bar's high must be at
    // least every contributing high, and its low at most every contributing low.
    const source = load(id);
    const derived = resample(source, into);
    const byStart = new Map(derived.t.map((t, i) => [t, i]));

    let checked = 0;
    for (let i = 0; i < source.t.length; i += 1) {
      const target = byStart.get(
        into === "1d"
          ? Date.UTC(
              new Date(source.t[i]!).getUTCFullYear(),
              new Date(source.t[i]!).getUTCMonth(),
              new Date(source.t[i]!).getUTCDate(),
            )
          : Math.floor(source.t[i]! / (into === "4h" ? 4 * 3_600_000 : 3_600_000)) *
              (into === "4h" ? 4 * 3_600_000 : 3_600_000),
      );
      if (target === undefined) continue;
      checked += 1;
      expect(derived.h[target]!).toBeGreaterThanOrEqual(source.h[i]!);
      expect(derived.l[target]!).toBeLessThanOrEqual(source.l[i]!);
    }
    expect(checked).toBeGreaterThan(0);
  });

  it.each(cases)("%s into %s keeps time ascending with no duplicates", (id, into) => {
    const derived = resample(load(id), into);
    expect(derived.t.length).toBeGreaterThan(0);
    for (let i = 1; i < derived.t.length; i += 1) {
      expect(derived.t[i]!).toBeGreaterThan(derived.t[i - 1]!);
    }
  });

  it.each(cases)("%s into %s produces bars whose close sits inside its range", (id, into) => {
    const derived = resample(load(id), into);
    for (let i = 0; i < derived.t.length; i += 1) {
      expect(derived.c[i]!).toBeLessThanOrEqual(derived.h[i]!);
      expect(derived.c[i]!).toBeGreaterThanOrEqual(derived.l[i]!);
      expect(derived.o[i]!).toBeLessThanOrEqual(derived.h[i]!);
      expect(derived.o[i]!).toBeGreaterThanOrEqual(derived.l[i]!);
    }
  });

  it("drops the session stub from every SPY trading day, as documented", () => {
    // Clock-aligned hours put 09:30-10:00 in a bucket of its own, which is then partial.
    // Asserted rather than left to be discovered: it is the visible cost of not having a
    // per-instrument session rule.
    const source = load("SPY-15m");
    const hourly = resample(source, "1h");
    const stubs = hourly.t.filter((t) => new Date(t).getUTCMinutes() !== 0);
    expect(stubs).toEqual([]);
    // And the 13:30 UTC hour (09:30 ET) never appears as a whole bar.
    const firstHours = hourly.t.filter((t) => new Date(t).getUTCHours() === 13);
    expect(firstHours).toEqual([]);
  });
});
