import type { LevelId } from "@/lib/store/schema";
import { CHAPTERS, levelIds } from "./chapters";
import { AUTHORED_IDS, isAuthoredId, loadLevelContent } from "./content";
import type { AnyLevel } from "./schema";

/**
 * What the app knows about levels without loading any of them.
 *
 * Everything here is either an id or derived from one, so this module is small
 * enough to ship on every route. Content arrives through `loadLevel`, one chunk per
 * level — see `./content/index.ts` for why.
 *
 * The duplicate-id and id-matches-chapter checks used to run here at module load,
 * over the whole set. They now live in `guards.test.ts`, which is the better home
 * anyway: an authoring mistake should fail CI rather than a player's first render,
 * and there is no longer a moment when every level is in memory to check.
 */

const AUTHORED = new Set<string>(AUTHORED_IDS);

/** Loads one level's content. Rejects only if the level file itself is malformed. */
export async function loadLevel(id: string): Promise<AnyLevel | undefined> {
  return loadLevelContent(id);
}

export function isAuthored(id: string): boolean {
  return isAuthoredId(id);
}

export function authoredInChapter(chapter: number): LevelId[] {
  return AUTHORED_IDS.filter(
    (id) => Number(id.split("-")[0]) === chapter,
  ) as LevelId[];
}

/** Ids a chapter defines that have no authored level yet. */
export function missingInChapter(chapter: number): LevelId[] {
  const meta = CHAPTERS.find((c) => c.n === chapter);
  if (!meta) return [];
  return levelIds(meta).filter((id) => !AUTHORED.has(id));
}
