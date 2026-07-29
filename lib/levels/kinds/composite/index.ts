import type { KindModule } from "../../kind-module";
import { Composite } from "./Composite";
import { gradeComposite, perfectComposite } from "./grade";

export const compositeKind: KindModule<"composite"> = {
  kind: "composite",
  Component: Composite,
  grade: gradeComposite,
  perfectAttempt: perfectComposite,
};
