import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseBaseRates, type BaseRates } from "./load-base-rates";
import { computeBaseRates } from "../../scripts/compute-base-rates";
import { wilsonInterval } from "@/lib/ta/base-rates";
import type { PatternKind } from "@/lib/ta/patterns";

/**
 * The committed base rates against what the shipped detector produces now.
 *
 * A stale artefact is the failure mode worth guarding: the file is fetched at runtime
 * and read by a level that presents it as measurement, so a detector threshold changed
 * without `npm run data:rates` would have Chapter 4 teaching last month's numbers with
 * this month's confidence. Recomputing here rather than checking a hash also means the
 * test says *what* moved.
 */

const committed = parseBaseRates(
  JSON.parse(readFileSync("public/data/base-rates.json", "utf8")),
) as BaseRates;

describe("committed base rates", () => {
  it("matches a fresh computation from the committed series", () => {
    expect(committed).toEqual(computeBaseRates());
  });

  it("carries the definition that produced the numbers", () => {
    // A base rate without its definition is a number pretending to be a fact. In
    // particular it has to say when the clock starts, since that single choice moved
    // double tops from 73% to a coin flip.
    expect(committed.definition).toMatch(/could first be known/);
    expect(committed.definition).toMatch(/four bars later/);
    expect(committed.horizon).toBe(10);
  });

  it("leaves out the series whose open is an artefact", () => {
    // EURUSD-1d reads as 72% dojis because Yahoo's FX open tracks the same bar's
    // close. See docs/AUTHORING.md.
    expect(committed.assets).not.toContain("EURUSD-1d");
    expect(committed.assets).toHaveLength(5);
  });

  it("reports every rate with a sample size and an interval", () => {
    for (const [kind, rates] of Object.entries(committed.patterns)) {
      for (const [asset, stats] of Object.entries(rates.byAsset)) {
        expect(stats.n, `${kind} ${asset}`).toBeGreaterThan(0);
        expect(stats.ci95[0]).toBeLessThanOrEqual(stats.winRate);
        expect(stats.ci95[1]).toBeGreaterThanOrEqual(stats.winRate);
      }
    }
  });
});

describe("what the numbers say, which is Chapter 4's whole argument", () => {
  const KINDS = Object.keys(committed.patterns) as PatternKind[];
  const pooled = (kind: PatternKind) => committed.patterns[kind].pooled;

  it("finds no pattern meaningfully better than a coin flip", () => {
    // 4.5 is built on this. If a pattern ever did separate, the level would need
    // rewriting rather than the assertion relaxing.
    for (const kind of KINDS) {
      expect(pooled(kind).winRate, kind).toBeGreaterThan(0.45);
      expect(pooled(kind).winRate, kind).toBeLessThan(0.55);
    }
  });

  it("keeps every pattern's interval overlapping every other's", () => {
    // The reason 4.5 cannot ask the player to rank by win rate: there is no ordering
    // here to be right about.
    for (const a of KINDS) {
      for (const b of KINDS) {
        expect(pooled(a).ci95[0], `${a} vs ${b}`).toBeLessThan(pooled(b).ci95[1]);
      }
    }
  });

  it("keeps forward returns near zero in ATR terms, in both directions", () => {
    // The magnitude check a binary win rate hides. Nothing here pays for its spread.
    for (const kind of KINDS) {
      expect(Math.abs(pooled(kind).meanFwdAtr), kind).toBeLessThan(0.25);
    }
  });

  it("does have a wide, rankable spread in how much evidence there is", () => {
    // What 4.5 asks instead, and it has to be unambiguous to be fair to rank.
    const sizes = KINDS.map((k) => pooled(k).n).sort((a, b) => b - a);
    expect(sizes[0]! / sizes.at(-1)!).toBeGreaterThan(20);
  });

  it("makes the rarest pattern's interval several times the widest common one", () => {
    // "The most impressive-looking rate has the least behind it", as a number.
    const width = (kind: PatternKind) => pooled(kind).ci95[1] - pooled(kind).ci95[0];
    expect(width("head-and-shoulders")).toBeGreaterThan(width("pin-bar") * 4);
  });

  it("shows the same rare pattern disagreeing wildly between two markets", () => {
    // The per-asset cells 4.5 puts side by side: identical rule, tiny samples,
    // answers forty points apart, and neither one means anything.
    const hs = committed.patterns["head-and-shoulders"]!.byAsset;
    const rates = Object.values(hs).map((s) => s.winRate);
    expect(Math.max(...rates) - Math.min(...rates)).toBeGreaterThan(0.3);
    for (const stats of Object.values(hs)) expect(stats.n).toBeLessThan(30);
  });
});

describe("wilson interval", () => {
  it("stays inside [0, 1] where the normal approximation would not", () => {
    // 4.5 shows an n=8 cell. The textbook interval on 8 samples runs past 100%, which
    // is a visible absurdity in a table the player is asked to trust.
    const [low, high] = wilsonInterval(7, 8);
    expect(low).toBeGreaterThan(0);
    expect(high).toBeLessThanOrEqual(1);
  });

  it("widens as the sample shrinks", () => {
    const wide = wilsonInterval(4, 8);
    const narrow = wilsonInterval(400, 800);
    expect(wide[1] - wide[0]).toBeGreaterThan((narrow[1] - narrow[0]) * 5);
  });

  it("spans everything when there is nothing to go on", () => {
    expect(wilsonInterval(0, 0)).toEqual([0, 1]);
  });
});
