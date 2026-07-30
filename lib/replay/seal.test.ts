import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Series } from "@/lib/chart/types";
import { KINDS, primedBarsFor, revealHorizonFor } from "@/lib/levels/kinds";
import { ALL_LEVELS } from "@/lib/levels/content";
import type { AnyLevel } from "@/lib/levels/schema";
import { createLevelFeed, type ReplayFeed } from "./feed";

/**
 * Proves the look-ahead seal over every authored level.
 *
 * The invariant, stated precisely: **what a kind component can read is exactly
 * what the player can see.** `visible()` is both the only way to read bars and the
 * only thing the chart renders, so the two cannot diverge. Advancing a feed is not
 * a leak — it shows the player those bars too. The failure this rules out is
 * reading unrevealed bars while displaying fewer, which is how a `predict-next`
 * kind would come to know the answer before the call was locked in.
 *
 * ## What this does not prove
 *
 * It says nothing about the network. Whole series files are fetched and shared
 * across levels by design — `lib/data/load-series.ts` caches per id — so a player
 * with devtools can read any bar of any committed series. Slicing per level would
 * break both that cache and the bar-index addressing scheme in docs/DATA.md.
 *
 * Chapter 10's holdback is the strong guarantee: out-of-sample data lives in
 * separate files that no level can even name, enforced at the type level by
 * `OosSeriesId`. This guard is the weaker, in-process one. Saying so here rather
 * than implying more is deliberate — the M3 winnability guard was documented as
 * proving more than it did, and that cost real debugging time later.
 */

function load(id: string): Series<string> {
  return JSON.parse(
    readFileSync(join("public/data/series", `${id}.json`), "utf8"),
  ) as Series<string>;
}

const seriesCache = new Map<string, Series<string>>();
function series(id: string): Series<string> {
  const hit = seriesCache.get(id);
  if (hit) return hit;
  const loaded = load(id);
  seriesCache.set(id, loaded);
  return loaded;
}

/** Builds feeds the way LevelPlayer does, so the test covers the real wiring. */
function feedsFor(level: AnyLevel): ReplayFeed[] {
  const horizon = revealHorizonFor(level);
  const primedBars = primedBarsFor(level) ?? undefined;
  return level.data.map((slice) =>
    createLevelFeed(series(slice.series), slice, { horizon, primedBars }),
  );
}

/** Every number reachable by walking an object graph, to a sane depth. */
function reachableNumbers(root: unknown, maxDepth = 8): Set<number> {
  const numbers = new Set<number>();
  const seen = new Set<object>();

  const walk = (value: unknown, depth: number) => {
    if (depth > maxDepth) return;
    if (typeof value === "number") {
      numbers.add(value);
      return;
    }
    if (value === null || typeof value !== "object") return;
    if (seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) {
      for (const item of value) walk(item, depth + 1);
      return;
    }
    for (const inner of Object.values(value as Record<string, unknown>)) {
      walk(inner, depth + 1);
    }
  };

  walk(root, 0);
  return numbers;
}

describe("the look-ahead seal", () => {
  it("covers every authored level, or it is proving nothing", () => {
    expect(ALL_LEVELS.length).toBeGreaterThan(10);
  });

  it("never exposes a bar past the reveal point, on any level", () => {
    for (const level of ALL_LEVELS) {
      const feeds = feedsFor(level);
      feeds.forEach((feed, i) => {
        const slice = level.data[i];
        if (!slice) return;
        const seen = feed.visible();
        expect(
          seen.t.length,
          `${level.id} slice ${i} reveals ${seen.t.length} bars, expected ${feed.at + 1}`,
        ).toBe(feed.at + 1);
        // The bar immediately past the reveal point is the one that matters: it is
        // the first bar of the answer on every predict-next level.
        expect(seen.c[feed.at + 1], `${level.id} slice ${i}`).toBeUndefined();
        expect(seen.h[feed.at + 1], `${level.id} slice ${i}`).toBeUndefined();
        expect(seen.l[feed.at + 1], `${level.id} slice ${i}`).toBeUndefined();
      });
    }
  });

  it("keeps absolute bar indices, so a level's authored index still resolves", () => {
    for (const level of ALL_LEVELS) {
      const feeds = feedsFor(level);
      feeds.forEach((feed, i) => {
        const slice = level.data[i];
        if (!slice) return;
        const full = series(slice.series);
        const seen = feed.visible();
        // The last visible bar must be the same bar it is in the full series.
        expect(seen.c[feed.at], `${level.id} slice ${i}`).toBe(full.c[feed.at]);
        expect(seen.t[slice.from], `${level.id} slice ${i}`).toBe(
          full.t[slice.from],
        );
      });
    }
  });

  it("does not leak a future price through anything reachable from a feed", () => {
    // The structural half. A grader legitimately holds the future; a component
    // holds only feeds, and this walks everything they lead to.
    for (const level of ALL_LEVELS) {
      const horizon = revealHorizonFor(level);
      if (horizon === 0) continue;
      const feeds = feedsFor(level);
      feeds.forEach((feed, i) => {
        const slice = level.data[i];
        if (!slice) return;
        const full = series(slice.series);
        const reachable = reachableNumbers({ feed, visible: feed.visible() });

        // Only values the withheld bars do not share with the revealed ones can
        // be evidence. Probing raw highs caught 1-B: bar 1462's high is 46000 and
        // bar 1365's low is also 46000 — a round number Bitcoin touched twice,
        // one side of the reveal each. Without this filter the guard cries leak
        // on a coincidence; with it, a component holding the full series still
        // fails, because most highs are not round numbers seen twice.
        const revealedValues = reachableNumbers(feed.visible());
        for (let bar = slice.to; bar < slice.to + horizon; bar += 1) {
          const withheld = full.h[bar];
          if (withheld === undefined) continue;
          if (revealedValues.has(withheld)) continue;
          expect(
            reachable.has(withheld),
            `${level.id} slice ${i}: bar ${bar} high ${withheld} is reachable before it is revealed`,
          ).toBe(false);
        }
      });
    }
  });

  it("reveals exactly the horizon the grader scores, and no more", () => {
    // Drift here would be invisible in play and wrong in principle: the player
    // would see bars the score never considered, or fewer than it did.
    for (const level of ALL_LEVELS) {
      const horizon = revealHorizonFor(level);
      if (horizon === 0) continue;
      const feeds = feedsFor(level);
      feeds.forEach((feed, i) => {
        const slice = level.data[i];
        if (!slice) return;
        const before = feed.at;
        feed.step(horizon);
        expect(feed.at - before, `${level.id} slice ${i}`).toBe(horizon);
        expect(feed.at, `${level.id} slice ${i}`).toBe(slice.to - 1 + horizon);
        // And it stops there — a second step reveals nothing further.
        feed.step(horizon);
        expect(feed.at, `${level.id} slice ${i}`).toBe(slice.to - 1 + horizon);
      });
    }
  });

  it("gives truth to the composite and to nothing else", () => {
    // `KindProps.truth` is the one intentional hole: a boss grades each stage as
    // the player finishes it, and grading a predict-next stage needs the future.
    // LevelPlayer passes it only for composite; this pins that down so a later
    // edit cannot quietly widen it.
    const source = readFileSync("components/level/LevelPlayer.tsx", "utf8");
    const truthLines = source
      .split("\n")
      .filter(
        (line) => line.includes("truth:") && !line.trimStart().startsWith("//"),
      );
    expect(truthLines).toHaveLength(1);
    expect(truthLines[0]).toContain('level.kind === "composite"');
  });

  it("declares a reveal horizon for exactly the kinds that reveal", () => {
    const revealing = Object.values(KINDS)
      .filter((kind) => kind.revealHorizon !== undefined)
      .map((kind) => kind.kind)
      .sort();
    // mark-bars and annotate show a fixed window; composite's stages carry their
    // own horizons, handled in step-components.ts.
    expect(revealing).toEqual(["classify", "predict-next"]);
  });
});
