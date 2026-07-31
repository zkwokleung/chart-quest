import type { KindModule } from "../../kind-module";
import { gradeSizingCalc, perfectSizingCalc } from "./grade";
import { SizingCalc } from "./SizingCalc";

export const sizingCalcKind: KindModule<"sizing-calc"> = {
  kind: "sizing-calc",
  Component: SizingCalc,
  grade: gradeSizingCalc,
  perfectAttempt: perfectSizingCalc,
};
