import type { KindModule } from "../../kinds";
import { gradePredictNext, perfectPredictNext } from "./grade";
import { PredictNext } from "./PredictNext";

export const predictNextKind: KindModule<"predict-next"> = {
  kind: "predict-next",
  Component: PredictNext,
  grade: gradePredictNext,
  perfectAttempt: perfectPredictNext,
};
