import { describe, expect, it } from "vitest";
import { CHAPTERS } from "@/lib/levels/chapters";
import type { LevelProgress, Persisted } from "@/lib/store/schema";
import { BLOCK_KINDS } from "./blocks";
import {
  chapterReached,
  paletteFor,
  PALETTE,
  resolvePalette,
  unlockedBlocks,
} from "./palette";

/**
 * The palette's unlock mapping, asserted rather than assumed — the same treatment
 * `lib/levels/skills.test.ts` gives the radar's axes.
 *
 * Two properties matter more than the individual rows. **Every block kind must be unlocked by
 * exactly one chapter**, or a block is either unreachable or arrives twice with two justifications.
 * And **the whole palette must be available by Chapter 10**, because a strategy the player cannot
 * finish composing is not a level.
 */

const attempted = (attempts = 1): LevelProgress => ({
  stars: 0,
  bestScore: 0,
  attempts,
  completedAt: null,
});

const progressFor = (ids: string[]): Persisted["progress"] =>
  Object.fromEntries(ids.map((id) => [id, attempted()])) as Persisted["progress"];

describe("the mapping", () => {
  it("unlocks every block kind exactly once", () => {
    expect([...PALETTE.map((e) => e.kind)].sort()).toEqual(
      [...BLOCK_KINDS].sort(),
    );
    // Two entries may share a chapter — Chapter 5 teaches both indicator blocks — but no kind may
    // appear twice, or it has two justifications and one of them is wrong.
    expect(new Set(PALETTE.map((e) => e.kind)).size).toBe(PALETTE.length);
  });

  it("unlocks everything by Chapter 10, which is when it is needed", () => {
    const composer = CHAPTERS.at(-1)!.n;
    for (const entry of PALETTE) {
      expect(entry.chapter, entry.kind).toBeLessThan(composer);
    }
    expect(unlockedBlocks(progressFor(["9-B"]))).toHaveLength(BLOCK_KINDS.length);
  });

  it("names a real chapter, and says what taught it", () => {
    for (const entry of PALETTE) {
      expect(CHAPTERS.map((c) => c.n)).toContain(entry.chapter);
      expect(entry.taughtBy.length, entry.kind).toBeGreaterThan(15);
      expect(entry.label.length, entry.kind).toBeGreaterThan(3);
    }
  });
});

describe("what a player has earned", () => {
  it("gives a beginner nothing, which is the point of the palette growing", () => {
    expect(unlockedBlocks(progressFor(["1-1", "1-2"]))).toEqual([]);
  });

  it("adds each chapter's block as that chapter is reached", () => {
    expect(unlockedBlocks(progressFor(["2-1"]))).toEqual(["structure"]);
    expect(unlockedBlocks(progressFor(["3-4"]))).toEqual(["structure", "zone"]);
    expect(unlockedBlocks(progressFor(["5-1"]))).toEqual([
      "structure",
      "zone",
      "cross",
      "compare",
    ]);
    expect(unlockedBlocks(progressFor(["8-2"]))).toHaveLength(BLOCK_KINDS.length);
  });

  it("counts a chapter as reached on an attempt rather than on a pass", () => {
    // **A deliberate choice.** Requiring stars would make the composer a second grading of chapters
    // already graded, and would leave the weakest players — the ones who most need the practice —
    // unable to build anything. How well they did is the skill radar's business.
    const failed = { "5-1": { ...attempted(4), stars: 0 as const, bestScore: 0.1 } };
    expect(unlockedBlocks(failed as Persisted["progress"])).toContain("cross");
  });

  it("ignores a level recorded with no attempts", () => {
    const untouched = { "8-1": attempted(0) } as Persisted["progress"];
    expect(chapterReached(untouched)).toBe(1);
    expect(unlockedBlocks(untouched)).toEqual([]);
  });

  it("shows locked entries rather than hiding them, so the palette can say what to play", () => {
    const shown = paletteFor(progressFor(["3-1"]));
    expect(shown).toHaveLength(PALETTE.length);
    expect(shown.filter((e) => e.unlocked).map((e) => e.kind)).toEqual([
      "structure",
      "zone",
    ]);
    const locked = shown.find((e) => !e.unlocked)!;
    expect(locked.taughtBy).toBeTruthy();
    expect(locked.chapter).toBeGreaterThan(3);
  });
});

describe("a level's own palette", () => {
  it("narrows to what the level names, whatever the player has earned", () => {
    // 10.3 teaches composing with two blocks before it hands over all five. A level saying "these
    // two" must win over a player's progress, or the level cannot stage anything.
    const everything = progressFor(["9-B"]);
    expect(resolvePalette(["cross", "compare"], everything)).toEqual([
      "cross",
      "compare",
    ]);
  });

  it("returns the level's kinds in the canonical order rather than the author's", () => {
    expect(resolvePalette(["volatility", "structure"], progressFor(["9-B"]))).toEqual([
      "structure",
      "volatility",
    ]);
  });

  it("falls back to the player's own unlocks when the level does not say", () => {
    expect(resolvePalette("unlocked", progressFor(["2-1"]))).toEqual(["structure"]);
  });
});
