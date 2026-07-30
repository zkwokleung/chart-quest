import { describe, expect, it } from "vitest";
import type { Series } from "@/lib/chart/types";
import { createFeed, fullyRevealed } from "./feed";

/** 20 bars, each unmistakable: bar i closes at 100 + i. */
function fixture(): Series<string> {
  const n = 20;
  const idx = Array.from({ length: n }, (_, i) => i);
  return {
    id: "FIXTURE-1d",
    tf: "1d",
    t: idx.map((i) => Date.UTC(2020, 0, i + 1)),
    o: idx.map((i) => 100 + i),
    h: idx.map((i) => 100.5 + i),
    l: idx.map((i) => 99.5 + i),
    c: idx.map((i) => 100 + i),
    v: idx.map(() => 1000),
  };
}

describe("createFeed", () => {
  it("primes to the whole window by default", () => {
    const feed = createFeed(fixture(), { from: 5, to: 15 });
    expect(feed.first).toBe(5);
    expect(feed.last).toBe(14);
    expect(feed.at).toBe(14);
    expect(feed.done).toBe(true);
  });

  it("primes to primeBars when asked, counting from the window start", () => {
    const feed = createFeed(fixture(), { from: 5, to: 15 }, { primeBars: 3 });
    expect(feed.at).toBe(7);
    expect(feed.done).toBe(false);
  });

  it("keeps absolute bar indices, so a level's authored index still resolves", () => {
    // The load-bearing property. Re-basing at `from` would have shifted every
    // index in 15 authored levels.
    const feed = createFeed(fixture(), { from: 5, to: 15 }, { primeBars: 3 });
    const seen = feed.visible();
    expect(seen.c[7]).toBe(107);
    expect(seen.c[5]).toBe(105);
  });

  it("does not expose a single bar past the reveal point", () => {
    const feed = createFeed(fixture(), { from: 0, to: 20 }, { primeBars: 10 });
    const seen = feed.visible();
    expect(seen.c).toHaveLength(10);
    expect(seen.c[9]).toBe(109);
    expect(seen.c[10]).toBeUndefined();
    expect(seen.h[10]).toBeUndefined();
    expect(seen.l[10]).toBeUndefined();
    expect(seen.t[10]).toBeUndefined();
  });

  it("holds the future beyond reach of any traversal of the feed", () => {
    // The seal itself. `series` lives in createFeed's closure, so walking
    // everything reachable from the feed must never turn up bar 15's close.
    const feed = createFeed(fixture(), { from: 0, to: 20 }, { primeBars: 5 });
    const reachable = new Set<unknown>();
    const walk = (value: unknown, depth = 0) => {
      if (depth > 6 || value === null || typeof value !== "object") {
        reachable.add(value);
        return;
      }
      if (reachable.has(value)) return;
      reachable.add(value);
      for (const inner of Object.values(value as Record<string, unknown>)) {
        walk(inner, depth + 1);
      }
    };
    walk(feed);
    walk(feed.visible());
    expect(reachable.has(115)).toBe(false);
    expect(reachable.has(104)).toBe(true);
  });

  it("steps forward and stops at the last bar", () => {
    const feed = createFeed(fixture(), { from: 0, to: 10 }, { primeBars: 1 });
    expect(feed.at).toBe(0);
    feed.step();
    expect(feed.at).toBe(1);
    feed.step(4);
    expect(feed.at).toBe(5);
    feed.step(100);
    expect(feed.at).toBe(9);
    expect(feed.done).toBe(true);
  });

  it("seeks backwards as well as forwards, which is what makes a replay scrubbable", () => {
    const feed = createFeed(fixture(), { from: 4, to: 16 }, { primeBars: 8 });
    feed.seek(6);
    expect(feed.at).toBe(6);
    expect(feed.visible().c).toHaveLength(7);
    feed.seek(15);
    expect(feed.at).toBe(15);
  });

  it("clamps a seek outside the window rather than revealing anything", () => {
    const feed = createFeed(fixture(), { from: 4, to: 16 });
    feed.seek(-100);
    expect(feed.at).toBe(4);
    feed.seek(9999);
    expect(feed.at).toBe(15);
    feed.seek(Number.NaN);
    expect(feed.at).toBe(4);
  });

  it("resets to where it was primed, not to the window start", () => {
    const feed = createFeed(fixture(), { from: 2, to: 18 }, { primeBars: 5 });
    feed.step(6);
    expect(feed.at).toBe(12);
    feed.reset();
    expect(feed.at).toBe(6);
  });

  it("honours revealTo so a level's window can contain the outcome it hides", () => {
    // A trade boss needs its slice to include the bars the grader scores, while
    // the player must not see them until the replay gets there.
    const feed = createFeed(
      fixture(),
      { from: 0, to: 20 },
      { primeBars: 4, revealTo: 12 },
    );
    expect(feed.last).toBe(12);
    feed.step(100);
    expect(feed.at).toBe(12);
    expect(feed.visible().c[13]).toBeUndefined();
  });

  it("never reveals past the window even when revealTo asks for more", () => {
    const feed = createFeed(fixture(), { from: 0, to: 10 }, { revealTo: 500 });
    expect(feed.last).toBe(9);
  });

  it("clamps a window running past the end of the series", () => {
    const feed = createFeed(fixture(), { from: 15, to: 400 });
    expect(feed.last).toBe(19);
    expect(feed.visible().c).toHaveLength(20);
  });

  it("memoises visible() per reveal point", () => {
    const feed = createFeed(fixture(), { from: 0, to: 20 }, { primeBars: 5 });
    const a = feed.visible();
    expect(feed.visible()).toBe(a);
    feed.step();
    const b = feed.visible();
    expect(b).not.toBe(a);
    feed.seek(4);
    expect(feed.visible()).toBe(a);
  });
});

describe("fullyRevealed", () => {
  it("behaves like the slice it replaces, for kinds that do not replay", () => {
    const feed = fullyRevealed(fixture(), { from: 3, to: 12 });
    expect(feed.done).toBe(true);
    expect(feed.at).toBe(11);
    // Still cut at the window's end: a classify level shows nine bars and the
    // bars after them are not the component's business either.
    expect(feed.visible().c).toHaveLength(12);
    expect(feed.visible().c[12]).toBeUndefined();
  });
});
