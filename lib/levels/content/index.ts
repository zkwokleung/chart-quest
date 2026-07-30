import type { AnyLevel } from "../schema";
import { level as ch1_1 } from "./ch1/1-1";
import { level as ch1_2 } from "./ch1/1-2";
import { level as ch1_3 } from "./ch1/1-3";
import { level as ch1_4 } from "./ch1/1-4";
import { level as ch1_5 } from "./ch1/1-5";
import { level as ch1_6 } from "./ch1/1-6";
import { level as ch1_7 } from "./ch1/1-7";
import { level as ch1_B } from "./ch1/1-B";
import { level as ch2_1 } from "./ch2/2-1";
import { level as ch2_2 } from "./ch2/2-2";
import { level as ch2_3 } from "./ch2/2-3";
import { level as ch2_4 } from "./ch2/2-4";
import { level as ch2_5 } from "./ch2/2-5";
import { level as ch2_6 } from "./ch2/2-6";
import { level as ch2_B } from "./ch2/2-B";
import { level as ch3_1 } from "./ch3/3-1";
import { level as ch3_2 } from "./ch3/3-2";
import { level as ch3_3 } from "./ch3/3-3";
import { level as ch3_4 } from "./ch3/3-4";
import { level as ch3_5 } from "./ch3/3-5";
import { level as ch3_6 } from "./ch3/3-6";
import { level as ch3_B } from "./ch3/3-B";

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
  ch2_1,
  ch2_2,
  ch2_3,
  ch2_4,
  ch2_5,
  ch2_6,
  ch2_B,
  ch3_1,
  ch3_2,
  ch3_3,
  ch3_4,
  ch3_5,
  ch3_6,
  ch3_B,
];
