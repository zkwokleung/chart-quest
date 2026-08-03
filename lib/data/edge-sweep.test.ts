import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Series, SeriesId } from "@/lib/chart/types";
import {
  computeEdgeSweep,
  IN_SAMPLE_FRACTION,
  LOOKBACKS,
  SWEPT,
  type EdgeSweepFile,
} from "@/lib/ta/edge-sweep";

/**
 * The committed sweep against what the shipped code computes, plus the handful of results
 * level 9.5 is built on.
 *
 * **This is 9.5's premise stated as a test.** If the in-sample optimum stops doing badly later,
 * the level's argument is wrong and the level should not ship — which is a different failure
 * from the code being wrong, and this is where the two are told apart.
 */

const committed = JSON.parse(
  readFileSync("public/data/edge-sweep.json", "utf8"),
) as EdgeSweepFile;

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

const fresh = computeEdgeSweep(load);
const forAsset = (id: string) => committed.assets.find((a) => a.asset === id)!;

describe("the committed file", () => {
  it("matches what the shipped code computes, exactly", () => {
    expect(committed).toEqual(fresh);
  });

  it("sweeps twenty-six lookbacks on four markets", () => {
    expect(committed.lookbacks).toEqual([...LOOKBACKS]);
    expect(committed.assets.map((a) => a.asset)).toEqual([...SWEPT]);
    expect(committed.inSampleFraction).toBe(IN_SAMPLE_FRACTION);
  });

  it("reports every total with its trade count", () => {
    for (const asset of committed.assets) {
      for (const cell of asset.cells) {
        expect(cell.inSample.trades, `${asset.asset} n=${cell.n}`).toBeGreaterThan(0);
        expect(cell.later.trades, `${asset.asset} n=${cell.n}`).toBeGreaterThan(0);
      }
    }
  });

  it("states where each split falls, so a reader can check it", () => {
    for (const asset of committed.assets) {
      expect(asset.splitDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(asset.splitBar).toBeGreaterThan(100);
    }
  });

  it("touches no out-of-sample data, which is Chapter 10's", () => {
    // 9.5 splits *inside* the in-sample series on purpose. `OosSeriesId` makes the alternative a
    // compile error, and this is the runtime half.
    for (const asset of committed.assets) {
      expect(asset.asset.endsWith("-oos")).toBe(false);
    }
    // The script's own docstring says it reads nothing there, so a string search for the path
    // hits the promise rather than a violation. What matters is that it neither imports the
    // holdback loader nor points its series directory at it.
    const source = readFileSync("scripts/compute-edge-sweep.ts", "utf8");
    expect(source).not.toContain("load-oos");
    expect(source).not.toContain("loadOosSeries");
    expect(source).toContain(`SERIES_DIR = "public/data/series"`);
  });
});

describe("what level 9.5 rests on", () => {
  it("has the tuned parameter doing worse later than most it did not pick", () => {
    // Gold and the index, the two markets the level leans on. The *rank* is the statistic
    // rather than the drop: a total falling can be blamed on a shorter window, and a rank
    // compares twenty-six parameters over the identical bars.
    for (const id of ["GC-1d", "SPY-1d"]) {
      const asset = forAsset(id);
      expect(asset.bestInSampleRankLater, id).toBeGreaterThan(
        asset.cells.length / 2,
      );
    }
    expect(forAsset("GC-1d").bestInSampleRankLater).toBe(21);
    expect(forAsset("SPY-1d").bestInSampleRankLater).toBe(25);
  });

  it("keeps the counter-example, so the level cannot teach a new false rule", () => {
    // Apple's optimum held up — third of twenty-six. Without it the level would replace "tuning
    // works" with "the optimum always collapses", which is equally untrue and harder to unlearn.
    const apple = forAsset("AAPL-1d");
    expect(apple.bestInSampleRankLater).toBeLessThanOrEqual(5);
  });

  it("keeps one market at the median, so the spread is not two poles", () => {
    const btc = forAsset("BTCUSDT-1d");
    expect(btc.bestInSampleRankLater).toBeGreaterThan(8);
    expect(btc.bestInSampleRankLater).toBeLessThan(19);
  });

  /** How much better the tuned parameter looked than an average one, in-sample. */
  const seduction = (id: string) => {
    const asset = forAsset(id);
    const totals = asset.cells.map((c) => c.inSample.totalR).sort((a, b) => a - b);
    const median = totals[Math.floor(totals.length / 2)]!;
    return asset.cells.find((c) => c.n === asset.bestInSample)!.inSample.totalR / median;
  };

  it("has a seductive in-sample peak on the markets the level leans on", () => {
    // The level teaches nothing unless the first window is genuinely tempting. Gold shows the
    // tuned parameter making 1.6x an average one; the index 1.9x.
    expect(seduction("SPY-1d")).toBeGreaterThan(1.8);
    expect(seduction("GC-1d")).toBeGreaterThan(1.5);
  });

  it("**punishes the sharper peak harder, monotonically across all four markets**", () => {
    // The finding that turned out to be the level. Ordering the four markets by how much
    // tuning appeared to help gives exactly their order by how badly it let them down:
    //
    //   SPY  1.94x seductive -> 25th of 26 later
    //   GC   1.64x           -> 21st
    //   BTC  1.38x           -> 13th
    //   AAPL 1.19x           ->  3rd
    //
    // So the lesson is not "the optimum collapses", which Apple disproves. It is that **how
    // excited the in-sample result made you predicts how much it will cost you** — which is a
    // claim about the tuner rather than about the market, and it survives the counter-example.
    const ordered = [...SWEPT].sort((a, b) => seduction(b) - seduction(a));
    const ranks = ordered.map((id) => forAsset(id).bestInSampleRankLater);
    expect(ordered).toEqual(["SPY-1d", "GC-1d", "BTCUSDT-1d", "AAPL-1d"]);
    expect(ranks).toEqual([25, 21, 13, 3]);
    // Monotone, stated as the property rather than as four numbers.
    for (let i = 1; i < ranks.length; i += 1) {
      expect(ranks[i]!, ordered[i]).toBeLessThan(ranks[i - 1]!);
    }
  });

  it("carries a drawdown in R for every cell, which 9.3 asks about", () => {
    for (const asset of committed.assets) {
      for (const cell of asset.cells) {
        expect(cell.inSample.maxDrawdownR).toBeGreaterThan(0);
        expect(Number.isFinite(cell.later.maxDrawdownR)).toBe(true);
      }
    }
  });

  it("has a deeper drawdown than a player would guess, which is 9.3's whole point", () => {
    // The specified level asks the player to guess the drawdown of a good-looking curve. That is
    // only a lesson if the answer is uncomfortable, so it is asserted rather than hoped for.
    const apple = forAsset("AAPL-1d");
    const best = apple.cells.find((c) => c.n === apple.bestInSample)!;
    expect(best.inSample.maxDrawdownR).toBeGreaterThan(5);
  });
});
