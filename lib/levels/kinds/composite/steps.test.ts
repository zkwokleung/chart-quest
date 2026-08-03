import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Series } from "@/lib/chart/types";
import { ALL_LEVELS } from "../../content/all";
import type { AnyStep, Level } from "../../schema";
import { stepAsAnyLevel, stepSources, weightsOf } from "./steps";

/**
 * Which series a boss's stage is actually handed.
 *
 * The interesting case is the one that used to be wrong: pairing a stage's slices with the boss's
 * loaded series **by position**. That was silent — the stage rendered, graded and scored, on a
 * chart of a different market — and no test would have caught it, because until 9.B every stage
 * either used the boss's own slices or narrowed its first series.
 */

const SERIES_DIR = "public/data/series";
const cache = new Map<string, Series<string>>();
function series(id: string): Series<string> {
  const hit = cache.get(id);
  if (hit) return hit;
  const loaded = JSON.parse(
    readFileSync(join(SERIES_DIR, `${id}.json`), "utf8"),
  ) as Series<string>;
  cache.set(id, loaded);
  return loaded;
}

const bosses = ALL_LEVELS.filter(
  (level): level is Level<"composite"> => level.kind === "composite",
);

/** A stand-in per slice, distinguishable by length so a mispairing is visible. */
function fakeTruth(level: Level<"composite">): Series<string>[] {
  return level.data.map((slice, i) => ({
    id: slice.series,
    tf: "1d",
    t: [i],
    o: [i],
    h: [i],
    l: [i],
    c: [i],
    v: [i],
  })) as unknown as Series<string>[];
}

describe("pairing a stage with its data", () => {
  it.each(bosses.map((b) => [b.id, b] as const))(
    "%s hands every stage the series it names",
    (_id, boss) => {
      const truth = fakeTruth(boss);
      for (const step of boss.config.steps) {
        const slices = step.data ?? boss.data;
        const sources = stepSources(boss, step, truth);
        expect(sources).toHaveLength(slices.length);
        sources.forEach((source, i) => {
          expect(source?.id, `${boss.id} stage "${step.brief}"`).toBe(
            slices[i]!.series,
          );
        });
      }
    },
  );

  it("would have failed under the positional pairing it replaced", () => {
    // **The regression, stated as the bug rather than as the fix.** 9.B is three reports on three
    // markets, one stage each, and every stage has a single slice — so `series[i]` with `i` the
    // slice's index *within the stage* is always 0, and all three reports would have charted the
    // boss's first series. Any boss whose stages name more than one distinct series proves the
    // difference; the test names the one that made it necessary.
    const boss = bosses.find((b) => b.id === "9-B")!;
    const positional = (step: AnyStep) =>
      (step.data ?? boss.data).map((_slice, i) => boss.data[i]?.series);
    const named = boss.config.steps.map((step) =>
      (step.data ?? boss.data).map((slice) => slice.series),
    );
    expect(new Set(named.flat()).size).toBe(3);
    expect(boss.config.steps.map(positional).flat()).toEqual([
      "SPY-1d",
      "SPY-1d",
      "SPY-1d",
    ]);
    expect(named.flat()).toEqual(["SPY-1d", "LAKE-1d", "AAPL-1d"]);
  });

  it("returns null for a slice whose series has not loaded", () => {
    const boss = bosses[0]!;
    expect(stepSources(boss, boss.config.steps[0]!, [])).toEqual(
      (boss.config.steps[0]!.data ?? boss.data).map(() => null),
    );
  });
});

describe("a stage as a level", () => {
  it.each(bosses.map((b) => [b.id, b] as const))(
    "%s keeps each stage on real data with its own kind",
    (_id, boss) => {
      for (const step of boss.config.steps) {
        const synthesised = stepAsAnyLevel(boss, step);
        expect(synthesised.kind).toBe(step.kind);
        expect(synthesised.id).toBe(boss.id);
        expect(synthesised.yAxis).toBe(boss.yAxis);
        for (const slice of synthesised.data) {
          const source = series(slice.series);
          expect(slice.to).toBeLessThanOrEqual(source.c.length);
        }
      }
    },
  );

  it("normalises weights that do not quite sum to one", () => {
    const steps = [{ weight: 0.5 }, { weight: 0.25 }] as unknown as AnyStep[];
    const [a, b] = weightsOf(steps);
    expect(a! + b!).toBeCloseTo(1, 10);
    expect(a! / b!).toBeCloseTo(2, 10);
  });
});
