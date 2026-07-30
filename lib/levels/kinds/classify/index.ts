import type { KindModule } from "../../kind-module";
import { Classify } from "./Classify";
import { gradeClassify, perfectClassify } from "./grade";

export const classifyKind: KindModule<"classify"> = {
  kind: "classify",
  Component: Classify,
  grade: gradeClassify,
  perfectAttempt: perfectClassify,
  // Committing extends the chart to show what happened next — the payoff for
  // having taken a position on the question. 3.4 reveals all six of its charts.
  revealHorizon: (level) => level.config.revealBars ?? 0,
};
