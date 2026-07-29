import type { KindModule } from "../../kind-module";
import { Classify } from "./Classify";
import { gradeClassify, perfectClassify } from "./grade";

export const classifyKind: KindModule<"classify"> = {
  kind: "classify",
  Component: Classify,
  grade: gradeClassify,
  perfectAttempt: perfectClassify,
};
