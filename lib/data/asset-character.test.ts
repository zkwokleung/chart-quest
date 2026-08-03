import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Series, SeriesId } from "@/lib/chart/types";
import {
  computeAssetCharacter,
  HORIZONS,
  SPINE,
  type AssetCharacterFile,
} from "@/lib/ta/asset-character";

/**
 * The committed artefact against what the shipped code computes.
 *
 * Same shape as `base-rates.test.ts`: a stale file breaks CI rather than quietly teaching
 * last month's numbers. Beyond drift, this pins the handful of results Chapter 8's levels are
 * built on, so a change to an estimator that moves a lesson fails here and not in front of a
 * player.
 */

const committed = JSON.parse(
  readFileSync("public/data/asset-character.json", "utf8"),
) as AssetCharacterFile;

const cache = new Map<string, Series<string>>();
function load(id: SeriesId): Series<string> {
  const hit = cache.get(id);
  if (hit) return hit;
  const loaded = JSON.parse(
    readFileSync(join("public/data/series", `${id}.json`), "utf8"),
  ) as Series<string>;
  cache.set(id, loaded);
  return loaded;
}

const fresh = computeAssetCharacter(load);

describe("the committed file", () => {
  it("matches what the shipped code computes, exactly", () => {
    expect(committed).toEqual(fresh);
  });

  it("covers the six markets and states the window it measured", () => {
    expect(committed.assets).toEqual([...SPINE]);
    expect(committed.window).toEqual({ from: "2017-08-17", to: "2023-04-28" });
    expect(committed.horizons).toEqual([...HORIZONS]);
  });

  it("reports the cost of honest alignment rather than hiding it", () => {
    // 1,429 days from Bitcoin's 2,081 bars in the window. The count travels with the file so
    // a reader can see what date-alignment cost, and so a regression in the day key shows up
    // here as a changed number rather than as a slightly different matrix.
    expect(committed.alignedDays).toBe(1429);
    expect(committed.byAsset["BTCUSDT-1d"]!.windowBars).toBe(2081);
    // 1,433 rather than 1,434: the window ends at midnight and the index's last bar that day
    // is stamped 13:30, so it falls outside. Stated because the near-miss is the kind of
    // off-by-one that looks like a bug in the alignment when it is a boundary choice.
    expect(committed.byAsset["SPY-1d"]!.windowBars).toBe(1433);
  });

  it("carries the definition that makes the numbers arguable", () => {
    expect(committed.definition).toContain("random walk");
    expect(committed.definition).toContain("heteroskedasticity-robust");
  });
});

describe("what Chapter 8 is built on", () => {
  it("spreads volatility five and a half fold, which is level 8.1", () => {
    const atrPct = (id: string) => committed.byAsset[id]!.atrPct;
    expect(atrPct("BTCUSDT-1d")).toBeCloseTo(4.6, 1);
    expect(atrPct("EURUSD-1d")).toBeCloseTo(0.82, 2);
    expect(atrPct("BTCUSDT-1d") / atrPct("EURUSD-1d")).toBeGreaterThan(5);
    // A ten percent move, in each market's own units.
    expect(10 / atrPct("BTCUSDT-1d")).toBeCloseTo(2.2, 1);
    expect(10 / atrPct("EURUSD-1d")).toBeCloseTo(12.2, 1);
  });

  it("puts Bitcoin alone above 1 at ninety bars, which is level 8.3's ranking", () => {
    const vr90 = (id: string) => committed.byAsset[id]!.vr.find((v) => v.q === 90)!.vr;
    const above = SPINE.filter((id) => vr90(id) > 1);
    expect(above).toEqual(["BTCUSDT-1d", "AAPL-1d"]);
    expect(vr90("BTCUSDT-1d")).toBeGreaterThan(1.35);
    expect(vr90("SPY-1d")).toBeLessThan(0.7);
  });

  it("finds only the index distinguishable from a random walk, and 8.2 must say so", () => {
    // The measurement that re-specced two levels. Bitcoin's ratio climbs to 1.41 and looks
    // emphatic; volatility clustering explains most of it. The index's short-horizon
    // reversion is the one effect in the spine that survives, and it survives across a
    // contiguous band of horizons rather than at one lucky point.
    const significant = (id: string) =>
      committed.byAsset[id]!.vr.filter((v) => Math.abs(v.z) >= 2).map((v) => v.q);

    expect(significant("SPY-1d")).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
    for (const id of SPINE.filter((x) => x !== "SPY-1d")) {
      expect(significant(id), `${id} should not be significant anywhere`).toEqual([]);
    }
  });

  it("keeps the spine genuinely diversified on ordinary days", () => {
    const m = committed.correlation.allDays;
    const at = (a: string, b: string) =>
      m.rows[m.assets.indexOf(a)]![m.assets.indexOf(b)]!;
    expect(at("SPY-1d", "AAPL-1d")).toBeGreaterThan(0.75);
    expect(Math.abs(at("EURUSD-1d", "SPY-1d")!)).toBeLessThan(0.08);
    expect(Math.abs(at("LAKE-1d", "SPY-1d")!)).toBeLessThan(0.1);
  });

  it("converges Bitcoin on everything when the index falls, which is level 8.4", () => {
    const all = committed.correlation.allDays;
    const worst = committed.correlation.indexWorstDecile;
    const calm = committed.correlation.calmDays;
    const at = (m: typeof all, a: string, b: string) =>
      m.rows[m.assets.indexOf(a)]![m.assets.indexOf(b)]!;

    expect(at(calm, "BTCUSDT-1d", "SPY-1d")!).toBeLessThan(0.15);
    expect(at(worst, "BTCUSDT-1d", "SPY-1d")!).toBeGreaterThan(0.4);
    expect(at(worst, "BTCUSDT-1d", "GC-1d")!).toBeGreaterThan(0.3);
    // And the pair that is always one bet does not get worse, so the lesson is "the hedge
    // stops hedging" rather than the slogan "correlations go to one".
    expect(at(worst, "SPY-1d", "AAPL-1d")!).toBeLessThan(at(all, "SPY-1d", "AAPL-1d")!);
  });

  it("cannot find a single gap to trade on a market that never closes", () => {
    // Level 8.6's anchor, and the only result in the chapter with no sample size attached:
    // structural rather than statistical, so no amount of data could overturn it.
    const gap = committed.edges.find((e) => e.id === "gap-fill")!;
    expect(gap.byAsset["BTCUSDT-1d"]!.trades).toBe(0);
    for (const id of SPINE.filter((x) => x !== "BTCUSDT-1d")) {
      expect(gap.byAsset[id]!.trades, `${id}`).toBeGreaterThan(50);
    }
  });

  it("makes one rule worth fifty times more on one market than another", () => {
    const breakout = committed.edges.find((e) => e.id === "breakout-20")!;
    const per = (id: string) => breakout.byAsset[id]!.perTradeR;
    // All six profitable — "six outcomes" was never what happened — but the spread is the
    // lesson, and the ordering does not follow persistence.
    for (const id of SPINE) expect(per(id), `${id}`).toBeGreaterThan(0);
    expect(per("AAPL-1d")).toBeGreaterThan(per("BTCUSDT-1d"));
    expect(per("GC-1d")).toBeGreaterThan(per("BTCUSDT-1d"));
    expect(per("AAPL-1d") / per("EURUSD-1d")).toBeGreaterThan(20);
  });

  it("has a year that breaks the rule nearly everywhere, which is level 8.5", () => {
    const breakout = committed.edges.find((e) => e.id === "breakout-20")!;
    const losers = SPINE.filter((id) => (breakout.byYear[id]!["2022"] ?? 0) <= 0);
    expect(losers.length).toBeGreaterThanOrEqual(3);
    // 2019 and 2020 are the contrast: the same rule paying nearly everywhere.
    const winners2020 = SPINE.filter((id) => (breakout.byYear[id]!["2020"] ?? 0) > 0);
    expect(winners2020.length).toBeGreaterThanOrEqual(5);
  });
});
