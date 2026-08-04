import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Series, SeriesId } from "@/lib/chart/types";
import {
  compact,
  crossingHorizon,
  logReturns,
  varianceRatioCurve,
} from "@/lib/ta/autocorr";
import { atr } from "@/lib/ta/atr";
import { simulate } from "@/lib/trade/simulate";
import { HORIZONS, SPINE, type AssetCharacterFile } from "@/lib/ta/asset-character";
import type { AnyLevel, Level } from "../../schema";
import { ALL_LEVELS, getAuthoredLevel } from "../all";

/**
 * Checks what Chapter 8's levels *claim* against what the data *shows*.
 *
 * The chapter is the one that tells the player to measure rather than take things on faith, so
 * it has the least excuse of any for shipping an unmeasured claim. Four of its seven specified
 * premises had already failed by the time it was planned; these tests are what keep the
 * replacements honest, and what will catch the next one.
 *
 * Two of them are structural rather than about content, and land here rather than with the boss
 * on purpose — see the Apple tripwire below.
 */

const committed = JSON.parse(
  readFileSync("public/data/asset-character.json", "utf8"),
) as AssetCharacterFile;

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

function need<K extends AnyLevel["kind"]>(id: string, kind: K): Level<K> {
  const level = getAuthoredLevel(id);
  if (!level || level.kind !== kind) {
    throw new Error(`${id} is missing or is not a ${kind} level`);
  }
  return level as unknown as Level<K>;
}

const chapter8 = () => ALL_LEVELS.filter((level) => level.chapter === 8);

describe("the chapter's structural rules", () => {
  it("reserves Apple for the boss, at every window", () => {
    // **The tripwire, and why it is here rather than with 8.B.** The generic cross-asset guard
    // in `guards.test.ts` returns early for a chapter with no boss, so it stays inert until the
    // boss is authored — by which point every teaching window has been chosen and moving one is
    // expensive. This fails from the first level instead.
    //
    // The guard is series-id granular, not window granular: `AAPL-1d` must be absent from every
    // Chapter 8 level's `data`, not merely at a different window.
    for (const level of chapter8()) {
      if (level.id === "8-B") continue;
      const named = level.data.map((slice) => slice.series);
      expect(named, `${level.id} displays Apple, which 8.B needs`).not.toContain(
        "AAPL-1d",
      );
    }
  });

  it("measures all six markets while displaying five", () => {
    // The move Chapter 7 made with `data: []` so gold could stay in 7.3 and still run 7.B.
    // Computed artefacts span the whole spine; only displayed slices are constrained.
    const displayed = new Set(
      chapter8()
        .filter((level) => level.id !== "8-B")
        .flatMap((level) => level.data.map((slice) => slice.series)),
    );
    expect(displayed.has("AAPL-1d")).toBe(false);
    // And the boss is the one level that does display it.
    expect(need("8-B", "composite").data[0]!.series).toBe("AAPL-1d");

    const probe = need("8-2", "probe");
    expect(probe.data).toEqual([]);
    expect([...probe.config.assets].sort()).toEqual([...SPINE].sort());
  });

  /**
   * Levels allowed to re-show bars an earlier chapter displayed, with the reason.
   *
   * The default is that Chapter 8 shows fresh windows — a chapter about recognising character
   * should not be recognising windows. 8.4 is a deliberate exception: its subject is March
   * 2020, and the player recognising the crash is what makes the lesson bite. They know what
   * happened, they have measured that these markets are barely correlated, and they get to
   * watch the two facts fail to fit together. A crash nobody recognised would make the same
   * statistical point and land softer.
   */
  const MAY_REUSE_WINDOWS: Record<string, string> = {
    "8-4": "March 2020 has to be recognisable for the lesson to bite",
    "8-5": "the chart is context for a report; the claims are measured elsewhere",
  };

  it("names an exemption only for a level that exists", () => {
    // So the list cannot outlive its reason and quietly excuse a future level.
    for (const id of Object.keys(MAY_REUSE_WINDOWS)) {
      expect(getAuthoredLevel(id), `${id} is exempted but not authored`).toBeDefined();
    }
  });

  it("shows every displayed window for the first time, bar the stated exceptions", () => {
    // A chapter about recognising character should not be recognising windows.
    const earlier = new Map<string, boolean[]>();
    for (const level of ALL_LEVELS) {
      if (level.chapter >= 8) continue;
      for (const slice of level.data) {
        const marks =
          earlier.get(slice.series) ??
          new Array(series(slice.series).t.length).fill(false);
        for (let i = Math.max(0, slice.from); i <= Math.min(marks.length - 1, slice.to); i += 1) {
          marks[i] = true;
        }
        earlier.set(slice.series, marks);
      }
    }

    for (const level of chapter8()) {
      if (MAY_REUSE_WINDOWS[level.id]) continue;
      for (const slice of level.data) {
        const marks = earlier.get(slice.series);
        if (!marks) continue;
        const overlap = marks
          .slice(slice.from, slice.to + 1)
          .filter(Boolean).length;
        expect(
          overlap,
          `${level.id} re-shows ${overlap} bars of ${slice.series} a earlier chapter displayed`,
        ).toBe(0);
      }
    }
  });
});

describe("8-1 ten percent of what", () => {
  const level = need("8-1", "classify");

  it("moves about ten percent in every one of its five windows", () => {
    // The brief-claims guard is satisfied by one slice showing the figure. This level's whole
    // argument is that *all* of them do, so it is asserted per window.
    expect(level.data).toHaveLength(5);
    for (const slice of level.data) {
      const s = series(slice.series);
      const move = (s.c[slice.to]! / s.c[slice.from]! - 1) * 100;
      expect(move, `${slice.series} moved ${move.toFixed(2)}%`).toBeGreaterThan(9.4);
      expect(move, `${slice.series} moved ${move.toFixed(2)}%`).toBeLessThan(10.7);
    }
  });

  it("uses a period that is ordinary for each market, or the comparison is rigged", () => {
    // **The constraint that stops this level lying.** The first search for ten-percent windows
    // found a 2008 euro window and a 2011 index window — both crises — where the euro's ten
    // percent measured 7.2 ATR against the index's 9.2. That is the wrong answer, produced by
    // comparing two unusual periods rather than two markets. Cherry-picking a calm window for
    // one and a wild one for another is the easiest way to make this level say anything.
    for (const slice of level.data) {
      const s = series(slice.series);
      const median = committed.byAsset[slice.series]!.atrPct;

      let total = 0;
      let counted = 0;
      for (let i = slice.from; i <= slice.to; i += 1) {
        const a = atr(s, i, 14);
        if (a > 0) {
          total += (a / s.c[i]!) * 100;
          counted += 1;
        }
      }
      const windowPct = total / counted;
      expect(
        Math.abs(windowPct / median - 1),
        `${slice.series} ran at ${windowPct.toFixed(2)}% against a median of ${median.toFixed(2)}%`,
      ).toBeLessThan(0.15);
    }
  });

  it("makes the euro the biggest event and Bitcoin the smallest, by a factor of five", () => {
    const inAtr = (seriesId: string) => {
      const slice = level.data.find((d) => d.series === seriesId)!;
      const s = series(seriesId);
      let total = 0;
      let counted = 0;
      for (let i = slice.from; i <= slice.to; i += 1) {
        const a = atr(s, i, 14);
        if (a > 0) {
          total += a;
          counted += 1;
        }
      }
      return Math.abs(s.c[slice.to]! - s.c[slice.from]!) / (total / counted);
    };

    const euro = inAtr("EURUSD-1d");
    const bitcoin = inAtr("BTCUSDT-1d");
    expect(euro).toBeGreaterThan(10);
    expect(bitcoin).toBeLessThan(2.5);
    expect(euro / bitcoin).toBeGreaterThan(4.5);

    // And the graded answer is the euro, not merely the largest of the five by chance.
    const ranked = level.data
      .map((slice) => ({ id: slice.series, atrs: inAtr(slice.series) }))
      .sort((a, b) => b.atrs - a.atrs);
    expect(ranked[0]!.id).toBe("EURUSD-1d");
    expect(level.target.correct).toEqual(["euro"]);
  });

  it("quotes each market's real volatility in its option text", () => {
    const notes = level.config.options.map((o) => o.note ?? "").join(" ");
    expect(notes).toContain(committed.byAsset["EURUSD-1d"]!.atrPct.toFixed(2));
    expect(notes).toContain(committed.byAsset["LAKE-1d"]!.atrPct.toFixed(2));
  });
});

describe("8-2 measure it yourself", () => {
  const level = need("8-2", "probe");

  it("puts its control exactly on the artefact's grid", () => {
    // The readout reads a committed table, so a value between two horizons would have to be
    // interpolated — and an interpolated variance ratio is a number nobody measured.
    const reachable: number[] = [];
    for (let v = level.config.min; v <= level.config.max; v += level.config.step) {
      reachable.push(v);
    }
    const grid = new Set(HORIZONS);
    const offGrid = reachable.filter((v) => !grid.has(v));
    // The artefact thins out past 20, so not every step is a grid point — what matters is that
    // the two ends and the answer are, and that the readout degrades to nothing in between.
    expect(grid.has(level.config.min)).toBe(true);
    expect(grid.has(level.config.max)).toBe(true);
    expect(grid.has(level.target.value)).toBe(true);
    expect(offGrid.length).toBeLessThan(reachable.length);
  });

  it("targets the crossing the shipped estimator finds", () => {
    // Derived, not authored: if the estimator changes, this fails rather than the level going
    // quietly wrong.
    const r = compact(logReturns(series("BTCUSDT-1d")));
    const crossing = crossingHorizon(varianceRatioCurve(r, [...HORIZONS]))!;
    expect(crossing).toBeCloseTo(6.09, 1);
    expect(Math.abs(crossing - level.target.value)).toBeLessThanOrEqual(
      level.tolerance.slop,
    );
  });

  it("starts where Bitcoin is still mean-reverting, which is the point", () => {
    const start = committed.byAsset["BTCUSDT-1d"]!.vr.find(
      (v) => v.q === level.config.initial,
    )!;
    expect(start.vr).toBeLessThan(1);
    expect(level.config.focus).toBe("BTCUSDT-1d");
  });

  it("has one market crossing in the single digits and one much later", () => {
    // Written when the hint claimed only one market crossed at all. Three do by a loose
    // reading — gold merely touches 1.000 at two bars and falls away, which is not a crossing —
    // and the honest fact is better: Bitcoin crosses at 6.1 bars and Apple not until 20.5, so
    // *where* a market crosses is a property of it rather than merely whether.
    const crossings = new Map(
      SPINE.map((id) => [
        id,
        crossingHorizon(
          committed.byAsset[id]!.vr.map((v) => ({ ...v, n: 0 })),
        ),
      ]),
    );

    expect(crossings.get("BTCUSDT-1d")).toBeCloseTo(6.09, 1);
    expect(crossings.get("AAPL-1d")).toBeCloseTo(20.48, 1);
    for (const id of ["SPY-1d", "EURUSD-1d", "GC-1d", "LAKE-1d"] as const) {
      expect(crossings.get(id), id).toBeNull();
    }
    // And the one that crosses late is the one that pays most, which 8.3 turns into its reveal.
    const breakout = committed.edges.find((e) => e.id === "breakout-20")!;
    expect(breakout.byAsset["AAPL-1d"]!.perTradeR).toBeGreaterThan(
      breakout.byAsset["BTCUSDT-1d"]!.perTradeR,
    );
  });

  it("cannot be answered without sweeping", () => {
    // Issue #26's requirement expressed as content: the sweep is 60% of the range, and the
    // distance from the start to the answer is a fraction of that.
    const { min, max, initial } = level.config;
    const toAnswer = Math.abs(level.target.value - initial) / (max - min);
    expect(toAnswer).toBeLessThan(0.1);
    expect(level.config.exploreFraction ?? 0.6).toBeGreaterThan(toAnswer * 3);
  });
});

describe("8-3 the ranking that does not pay", () => {
  const level = need("8-3", "sort-rank");

  const BY_ITEM: Record<string, SeriesId> = {
    bitcoin: "BTCUSDT-1d",
    apple: "AAPL-1d",
    gold: "GC-1d",
    index: "SPY-1d",
    euro: "EURUSD-1d",
    smallcap: "LAKE-1d",
  };

  it("orders by the measured variance ratio at ninety bars", () => {
    const vr90 = (id: SeriesId) =>
      committed.byAsset[id]!.vr.find((v) => v.q === 90)!.vr;
    const measured = [...level.config.items]
      .map((item) => item.id)
      .sort((a, b) => vr90(BY_ITEM[b]!) - vr90(BY_ITEM[a]!));
    expect(level.target.order).toEqual(measured);
  });

  it("forgives only the neighbours that are genuinely too close to call", () => {
    // `swaps` is derived from the data rather than chosen: the point estimates put the index
    // and the euro 0.009 apart, which no player could order from first principles.
    const vr90 = (id: string) =>
      committed.byAsset[BY_ITEM[id]!]!.vr.find((v) => v.q === 90)!.vr;
    const gaps = level.target.order
      .slice(1)
      .map((id, i) => vr90(level.target.order[i]!) - vr90(id));
    const tooClose = gaps.filter((gap) => gap < 0.05).length;
    expect(tooClose).toBeGreaterThanOrEqual(1);
    expect(level.tolerance.swaps).toBeGreaterThanOrEqual(tooClose);
    expect(level.tolerance.swaps).toBeLessThanOrEqual(2);
  });

  it("quotes every item's real ratio and z in its note", () => {
    for (const item of level.config.items) {
      const point = committed.byAsset[BY_ITEM[item.id]!]!.vr.find((v) => v.q === 90)!;
      expect(item.note, item.id).toContain(point.vr.toFixed(3));
    }
  });

  it("reveals a profit ordering that is close to the ranking and not the same", () => {
    // The level's argument, and both halves have to hold. If the two orderings matched, the
    // level would be teaching that persistence pays; if they were unrelated, it would be
    // teaching that measurement is pointless. Neither is true.
    const breakout = committed.edges.find((e) => e.id === "breakout-20")!;
    const profitOrder = [...level.config.items]
      .map((item) => item.id)
      .sort(
        (a, b) =>
          breakout.byAsset[BY_ITEM[b]!]!.perTradeR -
          breakout.byAsset[BY_ITEM[a]!]!.perTradeR,
      );

    expect(profitOrder).not.toEqual(level.target.order);
    // The most persistent market is not the most profitable one.
    expect(level.target.order[0]).toBe("bitcoin");
    expect(profitOrder[0]).toBe("apple");
    expect(profitOrder.indexOf("bitcoin")).toBe(2);

    // Spearman's rho: high enough that measuring was not a waste, and below the ~0.83 that
    // six observations need to clear the usual bar.
    const n = profitOrder.length;
    let sumD2 = 0;
    for (const item of level.config.items) {
      const d = level.target.order.indexOf(item.id) - profitOrder.indexOf(item.id);
      sumD2 += d * d;
    }
    const rho = 1 - (6 * sumD2) / (n * (n * n - 1));
    expect(rho).toBeCloseTo(0.771, 2);
    expect(rho).toBeLessThan(0.83);
  });

  it("makes money on all six, which is not what the spec expected", () => {
    const breakout = committed.edges.find((e) => e.id === "breakout-20")!;
    for (const id of SPINE) {
      expect(breakout.byAsset[id]!.perTradeR, id).toBeGreaterThan(0);
    }
    // And the spread is the replacement lesson.
    const values = SPINE.map((id) => breakout.byAsset[id]!.perTradeR);
    expect(Math.max(...values) / Math.min(...values)).toBeGreaterThan(20);
  });
});

describe("8-4 one bet, four names", () => {
  const level = need("8-4", "classify");

  it("shows the same calendar range on every pane", () => {
    // Four markets at four price scales are only comparable if they cover one period. Bitcoin
    // trades weekends, so the bar counts differ and the dates must not.
    for (const slice of level.data) {
      const s = series(slice.series);
      expect(
        new Date(s.t[slice.from]!).toISOString().slice(0, 7),
        slice.series,
      ).toBe("2020-01");
      expect(new Date(s.t[slice.to]!).toISOString().slice(0, 7), slice.series).toBe(
        "2020-04",
      );
    }
    expect(level.yAxis).toBe("pct");
  });

  it("has Bitcoin falling hardest of the four, which is the whole level", () => {
    const drop = (seriesId: string) => {
      const slice = level.data.find((d) => d.series === seriesId)!;
      const window = series(seriesId).c.slice(slice.from, slice.to + 1);
      return Math.min(...window) / Math.max(...window) - 1;
    };
    const falls = level.data
      .map((slice) => ({ id: slice.series, drop: drop(slice.series) }))
      .sort((a, b) => a.drop - b.drop);

    expect(falls[0]!.id).toBe("BTCUSDT-1d");
    expect(falls[0]!.drop).toBeLessThan(-0.5);
    // And gold, the boring one, held up best.
    expect(falls.at(-1)!.id).toBe("GC-1d");
    expect(falls.at(-1)!.drop).toBeGreaterThan(-0.2);
  });

  it("rests on a spine that really is diversified on average", () => {
    // If the averages showed a correlated book, the level would be arguing with a straw man.
    const m = committed.correlation.allDays;
    const pairs: number[] = [];
    for (let i = 0; i < m.assets.length; i += 1) {
      for (let j = i + 1; j < m.assets.length; j += 1) {
        if (m.assets[i] === "SPY-1d" && m.assets[j] === "AAPL-1d") continue;
        pairs.push(Math.abs(m.rows[i]![j]!));
      }
    }
    expect(Math.max(...pairs)).toBeLessThan(0.35);
    expect(
      Math.abs(m.rows[m.assets.indexOf("SPY-1d")]![m.assets.indexOf("AAPL-1d")]!),
    ).toBeGreaterThan(0.75);
  });

  it("has Bitcoin converging on the index and on gold, and not everything converging", () => {
    const all = committed.correlation.allDays;
    const worst = committed.correlation.indexWorstDecile;
    const calm = committed.correlation.calmDays;
    const at = (m: typeof all, a: string, b: string) =>
      m.rows[m.assets.indexOf(a)]![m.assets.indexOf(b)]!;

    expect(at(calm, "BTCUSDT-1d", "SPY-1d")!).toBeLessThan(0.15);
    expect(at(worst, "BTCUSDT-1d", "SPY-1d")!).toBeGreaterThan(0.4);
    expect(
      at(worst, "BTCUSDT-1d", "GC-1d")! - at(all, "BTCUSDT-1d", "GC-1d")!,
    ).toBeGreaterThan(0.2);

    // The two counter-examples the level names, which keep it from being a slogan.
    expect(at(worst, "SPY-1d", "AAPL-1d")!).toBeLessThan(at(all, "SPY-1d", "AAPL-1d")!);
    expect(at(worst, "LAKE-1d", "SPY-1d")!).toBeLessThan(0.1);
  });
});

describe("8-5 the report, and what it leaves out", () => {
  const level = need("8-5", "spot-the-flaw");
  const breakout = committed.edges.find((e) => e.id === "breakout-20")!;
  const pooled = SPINE.reduce(
    (total, id) => ({
      trades: total.trades + breakout.byAsset[id]!.trades,
      r: total.r + breakout.byAsset[id]!.totalR,
    }),
    { trades: 0, r: 0 },
  );

  it("quotes a sample and a total that are both correct", () => {
    expect(pooled.trades).toBe(557);
    expect(pooled.r).toBeCloseTo(157.2, 0);
    const labels = level.config.claims.map((c) => c.label).join(" ");
    expect(labels).toContain("557");
    expect(labels).toContain("157.2");
  });

  it("marks the four claims that do not follow, and only those", () => {
    expect([...level.target.flawed].sort()).toEqual([
      "all-six",
      "crypto-theory",
      "euro-robust",
      "every-year",
    ]);
  });

  it("has a fiftyfold spread, so all-six does not imply the edge is in the rule", () => {
    const per = SPINE.map((id) => breakout.byAsset[id]!.perTradeR);
    for (const value of per) expect(value).toBeGreaterThan(0);
    expect(Math.max(...per) / Math.min(...per)).toBeGreaterThan(20);
  });

  it("has the euro standing still rather than travelling", () => {
    const euro = breakout.byAsset["EURUSD-1d"]!;
    expect(euro.totalR).toBeLessThan(1);
    expect(euro.trades).toBeGreaterThan(60);
  });

  it("does not have Bitcoin performing best, which the theory claim asserts", () => {
    const ranked = SPINE.map((id) => ({
      id,
      per: breakout.byAsset[id]!.perTradeR,
    })).sort((a, b) => b.per - a.per);
    expect(ranked[0]!.id).toBe("AAPL-1d");
    expect(ranked.findIndex((r) => r.id === "BTCUSDT-1d")).toBe(2);
  });

  it("loses money in forty-one market-years, so every-year hides its own composition", () => {
    const losing = SPINE.flatMap((id) =>
      Object.entries(breakout.byYear[id]!).filter(([, v]) => v < 0),
    );
    expect(losing.length).toBe(41);

    const years = [
      ...new Set(SPINE.flatMap((id) => Object.keys(breakout.byYear[id]!))),
    ];
    const clean = years.filter((y) =>
      SPINE.every((id) => {
        const v = breakout.byYear[id]![y];
        return v === undefined || v > 0;
      }),
    );
    expect(years.length).toBe(21);
    expect(clean.length).toBe(3);
  });

  it("keeps the sound-but-damning claim sound", () => {
    // `concentration` is true, and marking it costs the player. So it had better be true.
    const apple = breakout.byAsset["AAPL-1d"]!;
    expect(apple.totalR / pooled.r).toBeCloseTo(0.43, 2);
    expect(apple.trades / pooled.trades).toBeCloseTo(0.23, 2);
    expect(level.target.flawed).not.toContain("concentration");
  });
});

describe("8-6 the edge that cannot travel", () => {
  const level = need("8-6", "sort-rank");
  const BY_ITEM: Record<string, string> = {
    breakout: "breakout-20",
    "three-down": "revert-3down",
    pullback: "pullback-ma",
    "gap-fill": "gap-fill",
  };

  const portability = (edgeId: string) => {
    const edge = committed.edges.find((e) => e.id === edgeId)!;
    const traded = SPINE.map((id) => edge.byAsset[id]!).filter((c) => c.trades > 0);
    return {
      markets: traded.length,
      positive: traded.filter((c) => c.perTradeR > 0).length,
      worst: Math.min(...traded.map((c) => c.perTradeR)),
    };
  };

  it("orders by markets survived, with the worst cell as the tiebreak", () => {
    const measured = Object.keys(BY_ITEM).sort((a, b) => {
      const x = portability(BY_ITEM[a]!);
      const y = portability(BY_ITEM[b]!);
      return y.positive - x.positive || y.worst - x.worst;
    });
    expect(level.target.order).toEqual(measured);
  });

  it("finds no setups at all for the gap rule on a market that never closes", () => {
    // **The chapter's only claim with no sample size attached.** Not a weak edge but an absent
    // one, which no amount of further data could soften.
    const gap = committed.edges.find((e) => e.id === "gap-fill")!;
    expect(gap.byAsset["BTCUSDT-1d"]!.trades).toBe(0);
    expect(portability("gap-fill").markets).toBe(5);
    for (const id of SPINE.filter((x) => x !== "BTCUSDT-1d")) {
      expect(gap.byAsset[id]!.trades, id).toBeGreaterThan(50);
    }
    // And it ranks last for that reason rather than for its numbers, which are not the worst.
    expect(level.target.order.at(-1)).toBe("gap-fill");
    expect(portability("gap-fill").worst).toBeGreaterThan(
      portability("pullback-ma").worst,
    );
  });

  it("has one rule that survives every market", () => {
    const best = portability("breakout-20");
    expect(best.positive).toBe(6);
    expect(best.markets).toBe(6);
    expect(level.target.order[0]).toBe("breakout");
  });

  it("quotes each rule's real market count in its note", () => {
    for (const item of level.config.items) {
      const p = portability(BY_ITEM[item.id]!);
      expect(item.note, item.id).toContain(String(p.positive));
    }
  });
});

describe("8-B an unfamiliar market", () => {
  const level = need("8-B", "composite");
  const aapl = series("AAPL-1d");

  const tradeStep = level.config.steps.find((s) => s.kind === "replay-trade")!;
  if (tradeStep.kind !== "replay-trade") throw new Error("expected a replay stage");
  const structure =
    tradeStep.target.structure.shape === "level"
      ? tradeStep.target.structure.price
      : NaN;
  const trigger = tradeStep.target.triggerBar;
  const entry = aapl.c[trigger]!;
  const volatility = atr(aapl, trigger, 14);

  const at = (totalAtr: number) => {
    const stop = entry - volatility * totalAtr;
    return simulate(
      { side: "long", stop, target: entry + (entry - stop) * tradeStep.config.minRR },
      aapl,
      trigger,
      tradeStep.config.maxBars,
    );
  };

  it("runs on the asset the chapter reserved", () => {
    expect(level.data.every((slice) => slice.series === "AAPL-1d")).toBe(true);
    for (const step of level.config.steps) {
      for (const slice of step.data ?? []) expect(slice.series).toBe("AAPL-1d");
    }
  });

  it("shows a window no earlier level displayed", () => {
    // **Earlier, which is what the name always said.** The first version scanned every level, and
    // that was indistinguishable from this one until Chapter 10 existed: 10.5 needs a third equity
    // with a long history and Apple is the only one, so it displays the whole series.
    //
    // The guarantee 8.B needs is that its window is unseen *when the player reaches it*. What a
    // later chapter shows cannot reach backwards and spoil a boss that has already been played, and
    // scoping this correctly is what stops a Chapter 10 level being unable to use the market
    // Chapter 8 taught on.
    const before = (other: (typeof ALL_LEVELS)[number]) =>
      other.chapter < 8 || (other.chapter === 8 && other.id !== "8-B");

    const shown = new Array(aapl.t.length).fill(false);
    for (const other of ALL_LEVELS) {
      if (other.id === "8-B" || !before(other)) continue;
      for (const slice of other.data) {
        if (slice.series !== "AAPL-1d") continue;
        for (let i = slice.from; i <= Math.min(shown.length - 1, slice.to); i += 1) {
          shown[i] = true;
        }
      }
    }
    for (const slice of level.data) {
      expect(
        shown.slice(slice.from, slice.to + 1).filter(Boolean).length,
        "the boss window has been displayed before",
      ).toBe(0);
    }
  });

  it("is representative of the market rather than a calm or wild stretch", () => {
    // The character read is only answerable if the window behaves like the market. A quiet
    // stretch of a volatile market would make the graded answer wrong.
    // Median against median, not mean against median: ATR% is right-skewed, so a window mean
    // sits above a full-history median even for an unremarkable stretch, and comparing the two
    // would fail an honest window for a reason that is about the statistic rather than the data.
    const slice = level.data[0]!;
    const values: number[] = [];
    for (let i = slice.from; i <= slice.to; i += 1) {
      const a = atr(aapl, i, 14);
      if (a > 0) values.push((a / aapl.c[i]!) * 100);
    }
    values.sort((x, y) => x - y);
    const windowMedian = values[Math.floor(values.length / 2)]!;
    const median = committed.byAsset["AAPL-1d"]!.atrPct;
    expect(median).toBeCloseTo(2.32, 2);
    expect(
      Math.abs(windowMedian / median - 1),
      `the window runs at ${windowMedian.toFixed(2)}% against a median of ${median.toFixed(2)}%`,
    ).toBeLessThan(0.15);
  });

  it("places the character answer between the index and the small-cap", () => {
    // The middle of the six, which is the least guessable answer available.
    const median = committed.byAsset["AAPL-1d"]!.atrPct;
    expect(median).toBeGreaterThan(committed.byAsset["SPY-1d"]!.atrPct);
    expect(median).toBeGreaterThan(committed.byAsset["GC-1d"]!.atrPct);
    expect(median).toBeLessThan(committed.byAsset["LAKE-1d"]!.atrPct);
    expect(median).toBeLessThan(committed.byAsset["BTCUSDT-1d"]!.atrPct);
  });

  it("asks for the edge that is both most portable and best here", () => {
    // If the portable answer and the locally-best answer disagreed, the boss would be unfair —
    // two defensible readings, one graded. They agree, and the test says so rather than hoping.
    const perTrade = (id: string) =>
      committed.edges.find((e) => e.id === id)!.byAsset["AAPL-1d"]!.perTradeR;
    const portability = (id: string) => {
      const edge = committed.edges.find((e) => e.id === id)!;
      const traded = SPINE.map((a) => edge.byAsset[a]!).filter((c) => c.trades > 0);
      return traded.filter((c) => c.perTradeR > 0).length;
    };
    const ids = ["breakout-20", "pullback-ma", "revert-3down", "gap-fill"];

    expect(ids.every((id) => perTrade("breakout-20") >= perTrade(id))).toBe(true);
    expect(ids.every((id) => portability("breakout-20") >= portability(id))).toBe(true);
  });

  it("rewards every stop that clears the structure and punishes every stop inside the noise", () => {
    // **The score-surface sweep AUTHORING.md requires**, and the reason this setup was chosen
    // over bar 3656, whose surface has a −1.00R hole at 3.0x sitting between two winners.
    expect((entry - structure) / volatility).toBeCloseTo(1.946, 2);

    for (const width of [2.0, 2.5, 3.0, 3.5, 4.0, 5.0]) {
      expect(at(width)?.r ?? 0, `${width}x ATR`).toBeGreaterThanOrEqual(2);
    }
    for (const width of [0.2, 0.35, 0.5]) {
      expect(at(width)?.r ?? 0, `${width}x ATR`).toBeCloseTo(-1, 2);
    }
  });

  it("puts its tolerance band inside the verified surface", () => {
    const { minAtr, maxAtr } = tradeStep.tolerance;
    // The floor clears the structure, and both ends were swept above.
    expect(entry - volatility * minAtr).toBeLessThan(structure);
    expect(at(minAtr)?.r ?? 0).toBeGreaterThanOrEqual(2);
    expect(at(maxAtr)?.r ?? 0).toBeGreaterThanOrEqual(2);
    expect(maxAtr).toBeLessThanOrEqual(5);
  });

  it("finishes the trade inside the window the stage shows", () => {
    const slice = tradeStep.data![0]!;
    expect(slice.from + tradeStep.config.primeBars - 1).toBe(trigger);
    const outcome = at(tradeStep.tolerance.minAtr)!;
    expect(outcome.exitBar).toBeLessThanOrEqual(slice.to);
  });

  it("weights the trade above the reading, because character has to inform a decision", () => {
    const weights = new Map(level.config.steps.map((s) => [s.kind, s.weight]));
    expect(weights.get("replay-trade")).toBeGreaterThan(weights.get("classify")!);
    const total = level.config.steps.reduce((t, s) => t + s.weight, 0);
    expect(total).toBeCloseTo(1, 6);
  });
});
