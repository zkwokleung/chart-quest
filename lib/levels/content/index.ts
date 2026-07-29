import type { AnyLevel } from "../schema";
import { level as ch1_1 } from "./ch1/1-1";
import { level as ch1_2 } from "./ch1/1-2";
import { level as ch1_3 } from "./ch1/1-3";
import { level as ch1_4 } from "./ch1/1-4";
import { level as ch1_5 } from "./ch1/1-5";
import { level as ch1_6 } from "./ch1/1-6";
import { level as ch1_7 } from "./ch1/1-7";
import { level as ch1_B } from "./ch1/1-B";

/**
 * Every authored level, imported explicitly.
 *
 * Not a dynamic glob: static imports keep the bundle analysable and tree-shakable,
 * and adding a level to this list is the one deliberate step that puts it in the
 * game. Chapters land one milestone at a time.
 */
export const ALL_LEVELS: AnyLevel[] = [
  ch1_1,
  ch1_2,
  ch1_3,
  ch1_4,
  ch1_5,
  ch1_6,
  ch1_7,
  ch1_B,
];
