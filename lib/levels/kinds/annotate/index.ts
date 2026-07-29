import type { KindModule } from "../../kind-module";
import { Annotate } from "./Annotate";
import { gradeAnnotate, perfectAnnotate } from "./grade";

export const annotateKind: KindModule<"annotate"> = {
  kind: "annotate",
  Component: Annotate,
  grade: gradeAnnotate,
  perfectAttempt: perfectAnnotate,
};
