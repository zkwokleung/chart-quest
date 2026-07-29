import type { KindModule } from "../../kinds";
import { gradeMarkBars, perfectMarkBars } from "./grade";
import { MarkBars } from "./MarkBars";

export const markBarsKind: KindModule<"mark-bars"> = {
  kind: "mark-bars",
  Component: MarkBars,
  grade: gradeMarkBars,
  perfectAttempt: perfectMarkBars,
};
