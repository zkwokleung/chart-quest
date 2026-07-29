import type { AnyLevel } from "../schema";

/**
 * Every authored level, imported explicitly.
 *
 * Not a dynamic glob: static imports keep the bundle analysable and tree-shakable,
 * and adding a level to this list is the one deliberate step that puts it in the
 * game. Chapters land one milestone at a time.
 */
export const ALL_LEVELS: AnyLevel[] = [];
