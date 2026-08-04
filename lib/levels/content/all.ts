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
import { level as ch4_1 } from "./ch4/4-1";
import { level as ch4_2 } from "./ch4/4-2";
import { level as ch4_3 } from "./ch4/4-3";
import { level as ch4_4 } from "./ch4/4-4";
import { level as ch4_5 } from "./ch4/4-5";
import { level as ch4_6 } from "./ch4/4-6";
import { level as ch4_B } from "./ch4/4-B";
import { level as ch5_1 } from "./ch5/5-1";
import { level as ch5_2 } from "./ch5/5-2";
import { level as ch5_3 } from "./ch5/5-3";
import { level as ch5_4 } from "./ch5/5-4";
import { level as ch5_5 } from "./ch5/5-5";
import { level as ch5_6 } from "./ch5/5-6";
import { level as ch5_B } from "./ch5/5-B";
import { level as ch6_1 } from "./ch6/6-1";
import { level as ch6_2 } from "./ch6/6-2";
import { level as ch6_3 } from "./ch6/6-3";
import { level as ch6_4 } from "./ch6/6-4";
import { level as ch6_5 } from "./ch6/6-5";
import { level as ch6_6 } from "./ch6/6-6";
import { level as ch6_B } from "./ch6/6-B";
import { level as ch7_1 } from "./ch7/7-1";
import { level as ch7_2 } from "./ch7/7-2";
import { level as ch7_3 } from "./ch7/7-3";
import { level as ch7_4 } from "./ch7/7-4";
import { level as ch7_5 } from "./ch7/7-5";
import { level as ch7_6 } from "./ch7/7-6";
import { level as ch7_7 } from "./ch7/7-7";
import { level as ch7_B } from "./ch7/7-B";
import { level as ch8_1 } from "./ch8/8-1";
import { level as ch8_2 } from "./ch8/8-2";
import { level as ch8_3 } from "./ch8/8-3";
import { level as ch8_4 } from "./ch8/8-4";
import { level as ch8_5 } from "./ch8/8-5";
import { level as ch8_6 } from "./ch8/8-6";
import { level as ch8_B } from "./ch8/8-B";
import { level as ch9_1 } from "./ch9/9-1";
import { level as ch9_2 } from "./ch9/9-2";
import { level as ch9_3 } from "./ch9/9-3";
import { level as ch9_4 } from "./ch9/9-4";
import { level as ch9_5 } from "./ch9/9-5";
import { level as ch9_6 } from "./ch9/9-6";
import { level as ch9_B } from "./ch9/9-B";
import { level as ch10_1 } from "./ch10/10-1";
import { level as ch10_2 } from "./ch10/10-2";
import { level as ch10_3 } from "./ch10/10-3";
import { level as ch10_4 } from "./ch10/10-4";
import { level as ch10_5 } from "./ch10/10-5";
import { level as ch10_6 } from "./ch10/10-6";
import { level as ch10_7 } from "./ch10/10-7";
import { level as ch10_B } from "./ch10/10-B";

/**
 * Every authored level, imported eagerly.
 *
 * **Node only.** Importing this from anything the browser loads puts the whole
 * curriculum in that bundle, which is the exact problem `./index.ts` exists to
 * solve — every level route used to ship all 29 levels because the registry did
 * this. Tests import it deliberately: they run in node and want the whole set at
 * once, and having them go through the dynamic loaders would buy nothing.
 *
 * A guard in `guards.test.ts` asserts this list and `LEVEL_LOADERS` name the same
 * levels, since the two can now drift.
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
  ch4_1,
  ch4_2,
  ch4_3,
  ch4_4,
  ch4_5,
  ch4_6,
  ch4_B,
  ch5_1,
  ch5_2,
  ch5_3,
  ch5_4,
  ch5_5,
  ch5_6,
  ch5_B,
  ch6_1,
  ch6_2,
  ch6_3,
  ch6_4,
  ch6_5,
  ch6_6,
  ch6_B,
  ch7_1,
  ch7_2,
  ch7_3,
  ch7_4,
  ch7_5,
  ch7_6,
  ch7_7,
  ch7_B,
  ch8_1,
  ch8_2,
  ch8_3,
  ch8_4,
  ch8_5,
  ch8_6,
  ch8_B,
  ch9_1,
  ch9_2,
  ch9_3,
  ch9_4,
  ch9_5,
  ch9_6,
  ch9_B,
  ch10_1,
  ch10_2,
  ch10_3,
  ch10_4,
  ch10_5,
  ch10_6,
  ch10_7,
  ch10_B,
];

/** A level by id, for tests. The app uses `loadLevelContent` in ./index.ts. */
export function getAuthoredLevel(id: string): AnyLevel | undefined {
  return ALL_LEVELS.find((level) => level.id === id);
}
