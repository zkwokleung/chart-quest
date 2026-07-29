import type { LevelId } from "@/lib/store/schema";
import { CHAPTERS, levelIds } from "./chapters";
import { ALL_LEVELS } from "./content";
import type { AnyLevel } from "./schema";

/**
 * Indexes the authored levels and checks them against the chapter definitions.
 *
 * Validation happens at module load rather than at render: a duplicate or
 * mis-numbered id is an authoring mistake, and it is far cheaper to find it when
 * the app boots than when a player opens the one level that is broken.
 */

function build(): Map<LevelId, AnyLevel> {
  const byId = new Map<LevelId, AnyLevel>();

  for (const level of ALL_LEVELS) {
    if (byId.has(level.id)) {
      throw new Error(`level ${level.id} is declared twice`);
    }
    const expectedChapter = Number(level.id.split("-")[0]);
    if (level.chapter !== expectedChapter) {
      throw new Error(
        `level ${level.id} declares chapter ${level.chapter}, expected ${expectedChapter}`,
      );
    }
    byId.set(level.id, level);
  }

  return byId;
}

const LEVELS = build();

export function getLevel(id: string): AnyLevel | undefined {
  return LEVELS.get(id as LevelId);
}

export function allLevels(): AnyLevel[] {
  return [...LEVELS.values()];
}

export function levelsInChapter(chapter: number): AnyLevel[] {
  return allLevels().filter((l) => l.chapter === chapter);
}

/** Ids a chapter defines that have no authored level yet. */
export function missingInChapter(chapter: number): LevelId[] {
  const meta = CHAPTERS.find((c) => c.n === chapter);
  if (!meta) return [];
  return levelIds(meta).filter((id) => !LEVELS.has(id));
}

export function isAuthored(id: string): boolean {
  return LEVELS.has(id as LevelId);
}
