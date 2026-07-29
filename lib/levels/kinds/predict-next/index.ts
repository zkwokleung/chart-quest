import type { KindModule } from "../../kind-module";
import { gradePredictNext, perfectPredictNext } from "./grade";
import { PredictNext } from "./PredictNext";

export const predictNextKind: KindModule<"predict-next"> = {
  kind: "predict-next",
  Component: PredictNext,
  grade: gradePredictNext,
  perfectAttempt: perfectPredictNext,
};
