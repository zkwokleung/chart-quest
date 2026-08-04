import type { LevelProgress, Persisted } from "@/lib/store/schema";
import { BLOCK_KINDS, type BlockKind } from "./blocks";

/**
 * Which blocks a player has earned, and the chapter each one comes from.
 *
 * **The palette is the player's progress made concrete** — issue #28's phrase, and the reason this
 * is derived from progress rather than authored per level. A composer showing every block from the
 * start would make Chapter 10 the first place the previous nine chapters stopped mattering.
 *
 * Declared with a test behind it, following `lib/levels/skills.ts`: every block kind is unlocked by
 * exactly one chapter, every unlock is a chapter that teaches the thing, and the whole palette is
 * available by Chapter 10 — because a strategy the player cannot finish composing is not a level,
 * it is a wall.
 *
 * ## Why unlocking is by *chapter reached* rather than by stars
 *
 * A player who scraped through Chapter 5 has met moving averages. Requiring three stars would make
 * the composer a second grading of chapters already graded, and would leave the weakest players —
 * the ones most in need of the practice — unable to build anything. Reaching the chapter is the
 * condition; how well they did is the skill radar's business.
 */

export type PaletteEntry = {
  kind: BlockKind;
  label: string;
  /** The chapter that teaches it and therefore unlocks it. */
  chapter: number;
  /** Where the player met it, so a locked entry can say what to play rather than just "locked". */
  taughtBy: string;
};

export const PALETTE: readonly PaletteEntry[] = [
  {
    kind: "structure",
    label: "Structure",
    chapter: 2,
    taughtBy: "swings, trends and breaks of structure",
  },
  {
    kind: "zone",
    label: "At a level",
    chapter: 3,
    taughtBy: "support, resistance and the retest",
  },
  {
    kind: "cross",
    label: "A crossing",
    chapter: 5,
    taughtBy: "moving averages, RSI and the MACD",
  },
  {
    kind: "compare",
    label: "A reading above or below",
    chapter: 5,
    taughtBy: "moving averages, RSI and the MACD",
  },
  {
    kind: "volatility",
    label: "How volatile it is",
    chapter: 8,
    taughtBy: "ATR as a share of price, per market",
  },
];

/**
 * The highest chapter the player has opened.
 *
 * Any attempt counts, not a pass: the palette asks whether they have *met* the block. Derived from
 * attempts rather than from `isChapterUnlocked` so a player who reached Chapter 8 and stalled on its
 * boss still composes with everything Chapter 8 taught them.
 */
export function chapterReached(progress: Persisted["progress"]): number {
  const map = progress as Record<string, LevelProgress | undefined>;
  let highest = 1;
  for (const [id, entry] of Object.entries(map)) {
    if (!entry || entry.attempts <= 0) continue;
    const chapter = Number(id.split("-")[0]);
    if (Number.isFinite(chapter)) highest = Math.max(highest, chapter);
  }
  return highest;
}

export function unlockedBlocks(progress: Persisted["progress"]): BlockKind[] {
  const reached = chapterReached(progress);
  return PALETTE.filter((entry) => entry.chapter <= reached).map((entry) => entry.kind);
}

/** Every entry, each marked with whether it is available. For a palette that shows its locks. */
export function paletteFor(
  progress: Persisted["progress"],
): (PaletteEntry & { unlocked: boolean })[] {
  const reached = chapterReached(progress);
  return PALETTE.map((entry) => ({ ...entry, unlocked: entry.chapter <= reached }));
}

/** Kinds a level explicitly allows, or everything the player has earned. */
export function resolvePalette(
  allowed: "unlocked" | readonly BlockKind[],
  progress: Persisted["progress"],
): BlockKind[] {
  if (allowed === "unlocked") return unlockedBlocks(progress);
  return BLOCK_KINDS.filter((kind) => allowed.includes(kind));
}
