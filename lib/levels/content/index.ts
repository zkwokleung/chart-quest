import type { LevelId } from "@/lib/store/schema";
import type { AnyLevel } from "../schema";

/**
 * Every authored level, behind a dynamic import keyed by id.
 *
 * The level registry is a client module, so until this existed every level route
 * shipped the entire curriculum: `/level/1-1` and `/level/3-B` were byte-for-byte
 * identical bundles, because a static import of all content is a static import of
 * all content no matter which page asks for it. Bundle size was a function of the
 * level count rather than of the page, and at 29 levels the route sat at 96% of its
 * budget with 44 levels still to write.
 *
 * The map is written out literally on purpose. A computed specifier like
 * `import(\`./ch${n}/${id}\`)` would defeat the bundler, which needs something
 * statically analysable to know which chunks to emit — it would either bundle
 * everything again or fail to find the files at all.
 *
 * The eager list lives in `./all.ts` and is imported only by tests. A guard asserts
 * the two name the same levels, because they can now drift.
 */
export const LEVEL_LOADERS = {
  "1-1": () => import("./ch1/1-1"),
  "1-2": () => import("./ch1/1-2"),
  "1-3": () => import("./ch1/1-3"),
  "1-4": () => import("./ch1/1-4"),
  "1-5": () => import("./ch1/1-5"),
  "1-6": () => import("./ch1/1-6"),
  "1-7": () => import("./ch1/1-7"),
  "1-B": () => import("./ch1/1-B"),
  "2-1": () => import("./ch2/2-1"),
  "2-2": () => import("./ch2/2-2"),
  "2-3": () => import("./ch2/2-3"),
  "2-4": () => import("./ch2/2-4"),
  "2-5": () => import("./ch2/2-5"),
  "2-6": () => import("./ch2/2-6"),
  "2-B": () => import("./ch2/2-B"),
  "3-1": () => import("./ch3/3-1"),
  "3-2": () => import("./ch3/3-2"),
  "3-3": () => import("./ch3/3-3"),
  "3-4": () => import("./ch3/3-4"),
  "3-5": () => import("./ch3/3-5"),
  "3-6": () => import("./ch3/3-6"),
  "3-B": () => import("./ch3/3-B"),
  "4-1": () => import("./ch4/4-1"),
  "4-2": () => import("./ch4/4-2"),
  "4-3": () => import("./ch4/4-3"),
  "4-4": () => import("./ch4/4-4"),
  "4-5": () => import("./ch4/4-5"),
  "4-6": () => import("./ch4/4-6"),
  "4-B": () => import("./ch4/4-B"),
  "5-1": () => import("./ch5/5-1"),
  "5-2": () => import("./ch5/5-2"),
  "5-3": () => import("./ch5/5-3"),
  "5-4": () => import("./ch5/5-4"),
  "5-5": () => import("./ch5/5-5"),
  "5-6": () => import("./ch5/5-6"),
  "5-B": () => import("./ch5/5-B"),
  "6-1": () => import("./ch6/6-1"),
  "6-2": () => import("./ch6/6-2"),
  "6-3": () => import("./ch6/6-3"),
  "6-4": () => import("./ch6/6-4"),
  "6-5": () => import("./ch6/6-5"),
  "6-6": () => import("./ch6/6-6"),
  "6-B": () => import("./ch6/6-B"),
} satisfies Record<string, () => Promise<{ level: AnyLevel }>>;

export type AuthoredLevelId = keyof typeof LEVEL_LOADERS;

/** The ids, synchronously. Cheap to ship everywhere; the content is not. */
export const AUTHORED_IDS = Object.keys(LEVEL_LOADERS) as AuthoredLevelId[];

export function isAuthoredId(id: string): id is AuthoredLevelId {
  return Object.hasOwn(LEVEL_LOADERS, id);
}

/** Resolves a level, or undefined when nothing is authored under that id. */
export async function loadLevelContent(
  id: string,
): Promise<AnyLevel | undefined> {
  if (!isAuthoredId(id)) return undefined;
  const loaded = await LEVEL_LOADERS[id]();
  const level = loaded.level;

  // Checked on load rather than at boot, because there is no longer a moment when
  // every level is in memory. A level filed under the wrong key would otherwise
  // resolve happily and then disagree with the route that asked for it.
  if (level.id !== (id as LevelId)) {
    throw new Error(`level file ${id} declares id ${level.id}`);
  }
  return level;
}
