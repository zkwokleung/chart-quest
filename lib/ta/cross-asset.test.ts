import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Series } from "@/lib/chart/types";
import {
  alignByDate,
  alignedReturns,
  dayKey,
  DAY_KEY_SHIFT_MS,
  jointDrawdowns,
  middleDaysOf,
  returnCorrelation,
  worstDaysOf,
} from "./cross-asset";

/**
 * The failure mode here is a matrix that looks right, not a crash, so the tests demonstrate
 * the wrong answers as well as checking the right one. Both wrong answers shipped in a draft
 * of Chapter 8's plan before they were caught.
 */

const SPINE = [
  "BTCUSDT-1d",
  "SPY-1d",
  "AAPL-1d",
  "EURUSD-1d",
  "GC-1d",
  "LAKE-1d",
] as const;

/** The window all six cover. */
const WINDOW = { from: Date.UTC(2017, 7, 17), to: Date.UTC(2023, 3, 28) };

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

const spine = () => SPINE.map((id) => series(id));

describe("the day key, and the two joins that look right and are not", () => {
  it("returns nothing at all when bars are joined on their raw timestamp", () => {
    // Each market stamps a daily bar at its own open, so no two series share an instant.
    const btc = new Set(series("BTCUSDT-1d").t);
    const shared = series("SPY-1d").t.filter((t) => btc.has(t));
    expect(shared).toHaveLength(0);
  });

  it("loses 160 days to the euro when joined on the UTC calendar day", () => {
    // The bug this module exists to prevent. EURUSD is stamped at 23:00 under BST, which the
    // naive key files as the previous day — so those bars never match anyone and the days
    // that survive are correlated against the wrong ones.
    const naive = (t: number) => Math.floor(t / 86_400_000);
    const count = (key: (t: number) => number) => {
      const maps = spine().map((s) => {
        const set = new Set<number>();
        s.t.forEach((t) => {
          if (t >= WINDOW.from && t <= WINDOW.to) set.add(key(t));
        });
        return set;
      });
      const [first, ...rest] = maps;
      return [...first!].filter((d) => rest.every((m) => m.has(d))).length;
    };

    expect(count(naive)).toBe(1269);
    expect(count(dayKey)).toBe(1429);
  });

  it("gives every series one bar per day, in order", () => {
    // The property that says the shift is sound for a series, rather than merely convenient.
    // If two consecutive bars collapsed onto one key, or swapped, the shift would be placing
    // that market's bars on the wrong days — which is the bug, seen from the other side.
    for (const id of SPINE) {
      const t = series(id).t;
      for (let i = 1; i < t.length; i += 1) {
        expect(
          dayKey(t[i]!) > dayKey(t[i - 1]!),
          `${id} bar ${i} (${new Date(t[i]!).toISOString()}) does not follow its predecessor`,
        ).toBe(true);
      }
    }
  });

  it("has nothing in the band where two hours would be an arbitrary choice", () => {
    // A bar stamped between 21:00 and 22:00 could belong to either day and the shift would
    // be guessing. None exists today; a new series that had one must be examined rather than
    // absorbed, so this fails loudly instead of skewing every matrix that includes it.
    for (const id of SPINE) {
      const ambiguous = series(id).t.filter((t) => {
        const hour = (t % 86_400_000) / 3_600_000;
        return hour >= 21 && hour < 22;
      });
      expect(ambiguous, `${id} has bars in the ambiguous band`).toHaveLength(0);
    }
    // And the euro really does need the shift: it is stamped at 23:00 for 2,759 bars.
    const late = series("EURUSD-1d").t.filter(
      (t) => (t % 86_400_000) / 3_600_000 === 23,
    );
    expect(late.length).toBe(2759);
    expect(DAY_KEY_SHIFT_MS).toBe(2 * 60 * 60 * 1000);
  });
});

describe("alignment", () => {
  it("keeps only the days every market traded", () => {
    const aligned = alignByDate(spine(), WINDOW);
    expect(aligned.days).toHaveLength(1429);
    expect(aligned.index).toHaveLength(6);
    for (const column of aligned.index) expect(column).toHaveLength(1429);
  });

  it("drops Bitcoin's weekends instead of pairing them with a stale index close", () => {
    // Forward-filling would invent a day on which the index did not move, and a zero return
    // against a live one is a correlation the data does not contain.
    const btc = series("BTCUSDT-1d");
    const inWindow = btc.t.filter((t) => t >= WINDOW.from && t <= WINDOW.to).length;
    expect(inWindow).toBe(2081);
    expect(alignByDate(spine(), WINDOW).days).toHaveLength(1429);
  });

  it("indexes back to the same calendar day in every series", () => {
    const all = spine();
    const aligned = alignByDate(all, WINDOW);
    for (const k of [0, 500, 1428]) {
      const keys = all.map((s, si) => dayKey(s.t[aligned.index[si]![k]!]!));
      expect(new Set(keys).size, `row ${k} spans more than one day`).toBe(1);
      expect(keys[0]).toBe(aligned.days[k]);
    }
  });

  it("returns a return per gap, not per day", () => {
    const r = alignedReturns(spine(), WINDOW);
    expect(r.days).toHaveLength(1429);
    for (const row of r.r) expect(row).toHaveLength(1428);
  });
});

describe("the matrix Chapter 8.4 rests on", () => {
  const aligned = alignedReturns(spine(), WINDOW);
  const matrix = returnCorrelation(SPINE, aligned);
  const at = (a: string, b: string) =>
    matrix.rows[SPINE.indexOf(a as never)]![SPINE.indexOf(b as never)]!;

  it("reports the sample behind every cell", () => {
    expect(matrix.n).toBe(1428);
  });

  it("is symmetric with ones down the diagonal", () => {
    for (let i = 0; i < SPINE.length; i += 1) {
      expect(matrix.rows[i]![i]).toBe(1);
      for (let j = 0; j < SPINE.length; j += 1) {
        expect(matrix.rows[i]![j]).toBeCloseTo(matrix.rows[j]![i]!, 10);
      }
    }
  });

  it("finds only one genuinely redundant pair", () => {
    // "Your five diversified longs are one bet" is not true of this spine, and 8.4 says so.
    // A single stock against its own index is, which is the obvious pair rather than a
    // surprising one — the surprise arrives in the conditional matrix below.
    expect(at("SPY-1d", "AAPL-1d")).toBeGreaterThan(0.75);
    const others: number[] = [];
    for (let i = 0; i < SPINE.length; i += 1) {
      for (let j = i + 1; j < SPINE.length; j += 1) {
        if (SPINE[i] === "SPY-1d" && SPINE[j] === "AAPL-1d") continue;
        others.push(Math.abs(matrix.rows[i]![j]!));
      }
    }
    expect(Math.max(...others)).toBeLessThan(0.35);
  });

  it("leaves the euro nearly independent, which the naive key hid", () => {
    // Under `floor(t/24h)` these read 0.16 and 0.25. They are 0.03 and 0.07.
    expect(Math.abs(at("EURUSD-1d", "SPY-1d"))).toBeLessThan(0.08);
    expect(Math.abs(at("EURUSD-1d", "GC-1d"))).toBeLessThan(0.12);
  });
});

describe("diversification on the days it is for", () => {
  const aligned = alignedReturns(spine(), WINDOW);
  const spy = SPINE.indexOf("SPY-1d");
  const worst = returnCorrelation(SPINE, aligned, worstDaysOf(aligned, spy, 0.1));
  const calm = returnCorrelation(SPINE, aligned, middleDaysOf(aligned, spy, 0.1));
  const at = (m: typeof worst, a: string, b: string) =>
    m.rows[SPINE.indexOf(a as never)]![SPINE.indexOf(b as never)]!;

  it("restricts to roughly the decile asked for", () => {
    expect(worst.n).toBeGreaterThan(120);
    expect(worst.n).toBeLessThan(160);
  });

  it("shows Bitcoin converging on everything when the index falls", () => {
    // 8.4's lesson. Uncorrelated on ordinary days, half an index position on the worst ones.
    const allDays = returnCorrelation(SPINE, aligned);
    for (const other of ["SPY-1d", "GC-1d"]) {
      const rose = at(worst, "BTCUSDT-1d", other)! - at(allDays, "BTCUSDT-1d", other)!;
      expect(rose, `BTC/${other}`).toBeGreaterThan(0.15);
    }
    expect(at(calm, "BTCUSDT-1d", "SPY-1d")!).toBeLessThan(0.15);
    expect(at(worst, "BTCUSDT-1d", "SPY-1d")!).toBeGreaterThan(0.4);
  });

  it("does not make the always-redundant pair worse, which keeps it from being a slogan", () => {
    // AAPL/SPY is already maximal, so a crisis cannot raise it. If every pair rose, the
    // lesson would be "correlations go to one" rather than "the hedge stops hedging".
    expect(at(worst, "SPY-1d", "AAPL-1d")!).toBeLessThan(at(returnCorrelation(SPINE, aligned), "SPY-1d", "AAPL-1d")!);
  });

  it("leaves the illiquid small-cap genuinely uncorrelated throughout", () => {
    expect(Math.abs(at(worst, "LAKE-1d", "SPY-1d")!)).toBeLessThan(0.15);
  });
});

describe("joint drawdowns", () => {
  const aligned = alignedReturns(spine(), WINDOW);
  const runs = jointDrawdowns(aligned, 5);

  it("returns the deepest first, all of them losses", () => {
    expect(runs).toHaveLength(5);
    for (const run of runs) {
      expect(run.book).toBeLessThan(0);
      expect(run.to).toBeGreaterThan(run.from);
      expect(run.perAsset).toHaveLength(6);
    }
    for (let i = 1; i < runs.length; i += 1) {
      expect(runs[i]!.book).toBeGreaterThanOrEqual(runs[i - 1]!.book);
    }
  });

  it("shows what each member did over the same span, which is the point", () => {
    // A book that fell while every member fell was never diversified, whatever its average
    // correlations said. The deepest run here should have most members underwater.
    const deepest = runs[0]!;
    expect(deepest.perAsset.filter((r) => r < 0).length).toBeGreaterThanOrEqual(4);
  });
});
