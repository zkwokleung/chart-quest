import type { LevelProgress, Persisted } from "@/lib/store/schema";
import { bossId, CHAPTERS, levelIds, type Chapter } from "./chapters";

/** A boss must be cleared to this standard before the next chapter opens. */
export const BOSS_STARS_TO_ADVANCE = 2;

type ProgressMap = Persisted["progress"];

function starsFor(progress: ProgressMap, id: string): number {
  return (progress as Record<string, LevelProgress | undefined>)[id]?.stars ?? 0;
}

/**
 * Chapter 1 is always open. Every other chapter needs the previous chapter's
 * boss cleared at BOSS_STARS_TO_ADVANCE — a bare pass is not enough, because the
 * boss is the cross-asset transfer check and scraping through it means the skill
 * did not transfer.
 */
export function isChapterUnlocked(
  chapter: number,
  progress: ProgressMap,
): boolean {
  if (chapter <= 1) return true;
  return starsFor(progress, bossId(chapter - 1)) >= BOSS_STARS_TO_ADVANCE;
}

/**
 * Levels open in order within a chapter: the first is always available, and each
 * later one needs at least one star on the level before it.
 */
export function isLevelUnlocked(
  chapter: Chapter,
  levelId: string,
  progress: ProgressMap,
): boolean {
  if (!isChapterUnlocked(chapter.n, progress)) return false;
  const ids = levelIds(chapter);
  const index = ids.indexOf(levelId as never);
  if (index <= 0) return index === 0;
  const previous = ids[index - 1];
  return previous !== undefined && starsFor(progress, previous) > 0;
}

export function chapterStars(chapter: Chapter, progress: ProgressMap): number {
  return levelIds(chapter).reduce((sum, id) => sum + starsFor(progress, id), 0);
}

export function chapterMaxStars(chapter: Chapter): number {
  return levelIds(chapter).length * 3;
}

export function totalStars(progress: ProgressMap): number {
  return CHAPTERS.reduce((sum, c) => sum + chapterStars(c, progress), 0);
}
