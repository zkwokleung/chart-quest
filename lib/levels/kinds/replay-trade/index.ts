import { assetClassOf } from "@/lib/instruments/asset-class";
import type { KindModule } from "../../kind-module";
import { gradeReplayTrade, perfectReplayTrade } from "./grade";
import { ReplayTrade } from "./ReplayTrade";

export const replayTradeKind: KindModule<"replay-trade"> = {
  kind: "replay-trade",
  Component: ReplayTrade,
  grade: gradeReplayTrade,
  perfectAttempt: perfectReplayTrade,
  // The slice already contains the outcome — the grader needs it — so the window
  // needs no widening. What it needs is a *narrower start*: the player sees
  // primeBars and reveals the rest by playing the replay.
  primedBars: (level) => level.config.primeBars,

  // Read off the grade's own overlay rather than recomputed, so the journal and
  // the score card can never disagree about what the trade did. Chapter 9 treats
  // this record as fact.
  journalEntry: (attempt, level, grade) => {
    const slice = level.data[0];
    if (!slice || grade.reference.kind !== "trade") return null;
    const trade = grade.reference;
    return {
      levelId: level.id,
      seriesId: slice.series,
      assetClass: assetClassOf(slice.series),
      entry: trade.entryPrice,
      stop: trade.stop,
      target: trade.target,
      exit: trade.exitPrice,
      r: trade.r,
      reason: attempt.reason,
      tags: [level.config.side, slice.series, `${grade.stars}-star`],
    };
  },
};
