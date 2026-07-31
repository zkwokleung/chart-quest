import type { KindModule } from "../../kind-module";
import { gradeSpotTheFlaw, perfectSpotTheFlaw } from "./grade";
import { SpotTheFlaw } from "./SpotTheFlaw";

export const spotTheFlawKind: KindModule<"spot-the-flaw"> = {
  kind: "spot-the-flaw",
  Component: SpotTheFlaw,
  grade: gradeSpotTheFlaw,
  perfectAttempt: perfectSpotTheFlaw,
};
