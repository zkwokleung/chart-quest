import type { KindModule } from "../../kind-module";
import { gradeTuneParam, perfectTuneParam } from "./grade";
import { TuneParam } from "./TuneParam";

export const tuneParamKind: KindModule<"tune-param"> = {
  kind: "tune-param",
  Component: TuneParam,
  grade: gradeTuneParam,
  perfectAttempt: perfectTuneParam,
};
