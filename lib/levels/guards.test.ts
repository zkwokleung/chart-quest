import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Series } from "@/lib/chart/types";
import type { SeriesManifest } from "@/lib/data/manifest-types";
import { AUTHORED_IDS } from "./content";
import { ALL_LEVELS } from "./content/all";
import { gradeAny, perfectAttemptFor } from "./kinds";
import type { AnyLevel } from "./schema";

/**
 * Guards that run over every authored level.
 *
 * Content authors satisfy these rather than writing them, which is what makes
 * ~73 levels tractable: an authoring mistake fails here instead of surfacing as
 * an unwinnable level a player gets stuck on.
 */

const SERIES_DIR = "public/data/series";

const manifest = JSON.parse(
  readFileSync(join(SERIES_DIR, "manifest.json"), "utf8"),
) as SeriesManifest;

const barsById = new Map(manifest.series.map((e) => [e.id, e.bars]));

const seriesCache = new Map<string, Series<string>>();
function loadCommitted(id: string): Series<string> {
  const cached = seriesCache.get(id);
  if (cached) return cached;
  const series = JSON.parse(
    readFileSync(join(SERIES_DIR, `${id}.json`), "utf8"),
  ) as Series<string>;
  seriesCache.set(id, series);
  return series;
}

const LEVELS = ALL_LEVELS;

/**
 * Chapter 1 is deliberately exempt from the boss-asset rule.
 *
 * docs/CURRICULUM.md specifies its levels as "BTC, SPY, EURUSD, mixed by design"
 * and its boss as "all three", so Chapter 1 cannot satisfy a difference rule and
 * the guard would fail on correct content. From Chapter 2 the rule means
 * something: a boss on a fresh asset is what proves the skill transferred.
 */
const BOSS_ASSET_RULE_FROM_CHAPTER = 2;

/**
 * Percentages in a brief that are not claims about this window's price action.
 *
 * The guard below verifies a figure by finding it in the data, which is the right
 * check for "price fell 12%" and the wrong one for a statistic or a quoted
 * convention. Rather than loosening it for everyone, the handful of exceptions are
 * named here with the reason, and each is verified in that chapter's own
 * content-claims test where the check can be specific.
 */
const NON_PRICE_FIGURES: Record<string, string[]> = {
  // The textbook's claim about two standard deviations, which the level exists to
  // disprove. The measured figure for this window is 88.8%, checked in
  // content/ch5/content-claims.test.ts.
  "5-2": ["95%"],
};

describe("authored levels", () => {
  it("there is at least one, or these guards are vacuous", () => {
    expect(LEVELS.length).toBeGreaterThan(0);
  });

  it("the eager list and the dynamic loaders name the same levels", () => {
    // The two can drift now that content loads per level: `all.ts` feeds these
    // guards and `index.ts` feeds the app, so a level added to one and not the
    // other is either untested or unreachable — and each failure is silent in the
    // opposite place from the one that caused it.
    expect([...AUTHORED_IDS].sort()).toEqual(LEVELS.map((l) => l.id).sort());
  });

  it("declares each level id exactly once", () => {
    // Moved here from the registry, which checked it at module load. There is no
    // longer a moment when every level is in memory, and an authoring mistake
    // belongs in CI rather than in a player's first render.
    const seen = new Set<string>();
    for (const level of LEVELS) {
      expect(seen.has(level.id), `${level.id} is declared twice`).toBe(false);
      seen.add(level.id);
    }
  });
});

describe.each(LEVELS.map((l) => [l.id, l] as const))("%s", (_id, level) => {
  const data = level.data.map((slice) => loadCommitted(slice.series));

  it("scores three stars for a perfect attempt", () => {
    // Proves the level is *winnable*: the grader can reach three stars, the
    // thresholds are not set above what a correct answer scores, and the tolerance
    // admits the target.
    //
    // It does NOT prove the target is the right answer. `perfectAttempt` is derived
    // from the target, so a target naming the wrong bar still passes — the check is
    // self-consistent by construction. Whether a claim is *true* is checked against
    // the data in content-claims.test.ts.
    const grade = gradeAny(level, perfectAttemptFor(level, data), data);
    expect(grade.stars).toBe(3);
  });

  it("authors at least two misconceptions", () => {
    expect(level.misconceptions.length).toBeGreaterThanOrEqual(2);
  });

  it("gives every misconception a unique id and a non-trivial message", () => {
    const ids = level.misconceptions.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of level.misconceptions) {
      expect(m.message.length).toBeGreaterThan(20);
    }
  });

  it("has ascending star thresholds inside (0, 1]", () => {
    const [a, b, c] = level.stars;
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThanOrEqual(b);
    expect(b).toBeLessThanOrEqual(c);
    expect(c).toBeLessThanOrEqual(1);
  });

  it("names only series that are committed", () => {
    for (const slice of level.data) {
      expect(barsById.has(slice.series)).toBe(true);
    }
  });

  it("keeps every bar range inside the series", () => {
    for (const slice of level.data) {
      const bars = barsById.get(slice.series) ?? 0;
      expect(slice.from).toBeGreaterThanOrEqual(0);
      expect(slice.to).toBeGreaterThan(slice.from);
      expect(slice.to).toBeLessThanOrEqual(bars);
    }
  });

  it("never references out-of-sample data", () => {
    // The runtime half of the holdback guarantee. OosSeriesId already makes this
    // a compile error, but a cast or a future loosening would slip past that.
    const slices =
      level.kind === "composite"
        ? [...level.data, ...level.config.steps.flatMap((st) => st.data ?? [])]
        : level.data;
    for (const slice of slices) {
      expect(slice.series.endsWith("-oos")).toBe(false);
    }
  });

  it("gives every composite step at least two misconceptions", () => {
    // A boss stage is a level in all but name, so the teaching invariant applies
    // per stage rather than once for the whole boss.
    if (level.kind !== "composite") return;
    for (const step of level.config.steps) {
      expect(
        step.misconceptions.length,
        `step "${step.brief}" has ${step.misconceptions.length}`,
      ).toBeGreaterThanOrEqual(2);
    }
  });

  it("has composite step weights summing to one", () => {
    if (level.kind !== "composite") return;
    const total = level.config.steps.reduce((sum, st) => sum + st.weight, 0);
    expect(total).toBeCloseTo(1, 3);
  });

  it("keeps every composite step's bar ranges inside its series", () => {
    if (level.kind !== "composite") return;
    for (const step of level.config.steps) {
      for (const slice of step.data ?? []) {
        const bars = barsById.get(slice.series) ?? 0;
        expect(bars).toBeGreaterThan(0);
        expect(slice.from).toBeGreaterThanOrEqual(0);
        expect(slice.to).toBeGreaterThan(slice.from);
        expect(slice.to).toBeLessThanOrEqual(bars);
      }
    }
  });

  it("keeps composite steps on the same series as the boss, in the same order", () => {
    // Step data may narrow a range but not swap the series: the player loads the
    // boss's series once, and the grader pairs them with step slices by position.
    if (level.kind !== "composite") return;
    const bossSeries = level.data.map((d) => d.series);
    for (const step of level.config.steps) {
      if (!step.data) continue;
      expect(step.data.map((d) => d.series)).toEqual(
        bossSeries.slice(0, step.data.length),
      );
    }
  });

  it("declares a chapter matching its id", () => {
    expect(level.chapter).toBe(Number(level.id.split("-")[0]));
  });

  it("quotes no unmeasured percentage in its brief", () => {
    // A figure in a brief must come from the data. Inventing one in a product
    // whose selling point is measured base rates would be self-defeating, so any
    // percentage has to be checkable against the slice the level shows.
    const percentages = level.brief.match(/\d+(\.\d+)?%/g) ?? [];
    for (const raw of percentages) {
      if (NON_PRICE_FIGURES[level.id]?.includes(raw)) continue;
      const claimed = Number(raw.replace("%", ""));
      const matches = level.data.some((slice) => {
        const series = loadCommitted(slice.series);
        for (let i = slice.from; i < slice.to; i += 1) {
          const o = series.o[i];
          const h = series.h[i];
          const l = series.l[i];
          const c = series.c[i];
          if (
            o === undefined ||
            h === undefined ||
            l === undefined ||
            c === undefined
          ) {
            continue;
          }
          const previousClose = i > 0 ? series.c[i - 1] : undefined;

          // The four ways a brief legitimately quotes a percentage: how far a bar
          // travelled, how far it closed from its open, how far it closed from the
          // previous close, and how far it opened away from it (a gap).
          const candidates = [
            ((h - l) / c) * 100,
            Math.abs(((c - o) / o) * 100),
            ...(previousClose === undefined
              ? []
              : [
                  Math.abs(((c - previousClose) / previousClose) * 100),
                  Math.abs(((o - previousClose) / previousClose) * 100),
                ]),
          ];

          if (candidates.some((value) => Math.abs(value - claimed) < 1))
            return true;
        }

        // A cumulative move between any two bars of the slice. Briefs legitimately
        // describe a stretch rather than a bar — 5.3's "55%" is 26 days of Bitcoin
        // — and without this the guard would reject a properly measured figure and
        // teach authors to round it until it matched some single candle.
        for (let a = slice.from; a < slice.to; a += 1) {
          const start = series.c[a];
          if (start === undefined || start === 0) continue;
          for (let b = a + 1; b < slice.to; b += 1) {
            const end = series.c[b];
            if (end === undefined) continue;
            if (
              Math.abs(Math.abs(((end - start) / start) * 100) - claimed) < 1
            ) {
              return true;
            }
          }
        }
        return false;
      });
      expect(
        matches,
        `brief claims ${raw} but no bar in the level's slices shows it`,
      ).toBe(true);
    }
  });
});

describe("chapter-level rules", () => {
  const byChapter = new Map<number, AnyLevel[]>();
  for (const level of LEVELS) {
    byChapter.set(level.chapter, [
      ...(byChapter.get(level.chapter) ?? []),
      level,
    ]);
  }

  it("runs each boss on an asset its chapter did not teach on", () => {
    for (const [chapter, levels] of byChapter) {
      if (chapter < BOSS_ASSET_RULE_FROM_CHAPTER) continue;
      const boss = levels.find((l) => l.id.endsWith("-B"));
      if (!boss) continue;

      const taught = new Set(
        levels
          .filter((l) => l !== boss)
          .flatMap((l) => l.data.map((s) => s.series)),
      );
      const bossSlices =
        boss.kind === "composite"
          ? [...boss.data, ...boss.config.steps.flatMap((st) => st.data ?? [])]
          : boss.data;
      for (const slice of bossSlices) {
        expect(
          taught.has(slice.series),
          `chapter ${chapter} boss uses ${slice.series}, which its levels already taught on`,
        ).toBe(false);
      }
    }
  });

  it("uses the reconstructed AAPL series in exactly one level", () => {
    // AAPL-1d-raw is deliberately misleading — split-unadjusted prices showing a
    // crash that never happened. It exists to be exposed once; teaching from it
    // anywhere else would be teaching from a known falsehood.
    const users = LEVELS.filter((l) =>
      l.data.some((s) => s.series === "AAPL-1d-raw"),
    );
    if (users.length === 0) return;
    expect(users.map((l) => l.id)).toHaveLength(1);
  });

  it("declares each level id only once", () => {
    const ids = LEVELS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
