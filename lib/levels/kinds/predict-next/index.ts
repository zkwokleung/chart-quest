import type { KindModule } from "../../kind-module";
import { gradePredictNext, perfectPredictNext } from "./grade";
import { PredictNext } from "./PredictNext";

export const predictNextKind: KindModule<"predict-next"> = {
  kind: "predict-next",
  Component: PredictNext,
  grade: gradePredictNext,
  perfectAttempt: perfectPredictNext,
  // The bars a locked-in call is measured against. Same number the grader uses,
  // read from the same place, so the reveal cannot show more than was scored.
  revealHorizon: (level) => level.config.horizon,
};
