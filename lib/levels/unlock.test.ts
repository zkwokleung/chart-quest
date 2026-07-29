import { describe, expect, it } from "vitest";
import type { LevelId, LevelProgress, Persisted } from "@/lib/store/schema";
import { CHAPTERS, getChapter, levelIds } from "./chapters";
import {
  BOSS_STARS_TO_ADVANCE,
  chapterMaxStars,
  chapterStars,
  isChapterUnlocked,
  isLevelUnlocked,
  totalStars,
} from "./unlock";

function progress(
  entries: Partial<Record<LevelId, number>>,
): Persisted["progress"] {
  const out: Record<string, LevelProgress> = {};
  for (const [id, stars] of Object.entries(entries)) {
    out[id] = {
      stars: (stars ?? 0) as LevelProgress["stars"],
      bestScore: 0.8,
      attempts: 1,
      completedAt: null,
    };
  }
  return out as Persisted["progress"];
}

describe("isChapterUnlocked", () => {
  it("opens chapter 1 with no progress", () => {
    expect(isChapterUnlocked(1, {})).toBe(true);
  });

  it("keeps later chapters shut until the previous boss is cleared", () => {
    expect(isChapterUnlocked(2, {})).toBe(false);
    expect(isChapterUnlocked(2, progress({ "1-B": 1 }))).toBe(false);
  });

  it("requires the full standard, not a bare pass", () => {
    // The boss is the cross-asset transfer check. Scraping through it means the
    // skill did not transfer, so one star must not advance the player.
    expect(BOSS_STARS_TO_ADVANCE).toBe(2);
    expect(isChapterUnlocked(2, progress({ "1-B": 2 }))).toBe(true);
    expect(isChapterUnlocked(2, progress({ "1-B": 3 }))).toBe(true);
  });

  it("does not let a later chapter's boss unlock an earlier gate", () => {
    expect(isChapterUnlocked(3, progress({ "1-B": 3 }))).toBe(false);
  });
});

describe("isLevelUnlocked", () => {
  const ch1 = getChapter(1);

  it("opens the first level of an unlocked chapter", () => {
    expect(ch1).toBeDefined();
    if (!ch1) return;
    expect(isLevelUnlocked(ch1, "1-1", {})).toBe(true);
    expect(isLevelUnlocked(ch1, "1-2", {})).toBe(false);
  });

  it("advances one level at a time", () => {
    if (!ch1) return;
    const p = progress({ "1-1": 1 });
    expect(isLevelUnlocked(ch1, "1-2", p)).toBe(true);
    expect(isLevelUnlocked(ch1, "1-3", p)).toBe(false);
  });

  it("gates the boss behind the last regular level", () => {
    if (!ch1) return;
    const ids = levelIds(ch1);
    const last = ids[ids.length - 2];
    expect(last).toBe("1-7");
    expect(isLevelUnlocked(ch1, "1-B", progress({ "1-7": 2 }))).toBe(true);
    expect(isLevelUnlocked(ch1, "1-B", progress({ "1-6": 3 }))).toBe(false);
  });

  it("keeps every level shut in a locked chapter", () => {
    const ch2 = getChapter(2);
    if (!ch2) return;
    expect(isLevelUnlocked(ch2, "2-1", {})).toBe(false);
  });
});

describe("star counting", () => {
  it("sums a chapter and the whole game", () => {
    const p = progress({ "1-1": 3, "1-2": 2, "2-1": 1 });
    const ch1 = getChapter(1);
    if (!ch1) return;

    expect(chapterStars(ch1, p)).toBe(5);
    expect(totalStars(p)).toBe(6);
  });

  it("counts the boss in the chapter maximum", () => {
    const ch1 = getChapter(1);
    if (!ch1) return;
    // 7 levels + 1 boss, three stars each.
    expect(chapterMaxStars(ch1)).toBe(24);
  });

  it("covers all ten chapters", () => {
    expect(CHAPTERS).toHaveLength(10);
    expect(CHAPTERS.map((c) => c.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});
