import type { Series } from "@/lib/chart/types";
import { assetClassOf } from "@/lib/instruments/asset-class";
import type { JournalDraft } from "../../kind-module";
import { simulate } from "@/lib/trade/simulate";
import { diagnose, starsFor, type Grade } from "../../grade";
import type { Attempt, Level } from "../../schema";

/**
 * Ten trades in a row, scored on how they were sized.
 *
 * ## Why this is not "scored on expectancy"
 *
 * The epic asked for a boss scored on expectancy rather than profit. Working it through, that
 * cannot mean what it sounds like: the trades are historical, so **their R outcomes are fixed
 * before the player touches anything**. No sizing decision can change the expectancy in R of a
 * sequence that already happened.
 *
 * What sizing changes is the *account path* — and that is the whole subject of Chapter 7. So the
 * score is on process, which is the honest reading of "not profit": did the risk stay modest,
 * did it stay consistent, and did the account survive. A player handed a good run at reckless
 * size has not done the thing correctly, and a player handed the 13-loss streak at 1% has.
 *
 * ## Three components
 *
 * `survival` is a gate rather than a gradient: an account through the ruin line is the one
 * outcome the chapter treats as unrecoverable.
 *
 * `restraint` is the share of trades sized at or under the defensible cap.
 *
 * `consistency` is the share of trades that did *not* raise risk after a loss. Raising after a
 * loss is the martingale, and it is the specific error that turns a losing streak into a wiped
 * account — so it is scored separately rather than folded into restraint.
 */

const WEIGHTS = { survival: 0.4, restraint: 0.3, consistency: 0.3 };

/**
 * One trade of a sequence, with the prices the journal needs.
 *
 * `{r, risk, equity}` was enough to score and to render, and nothing else asked — which is why
 * 7.B's ten trades were never journalled: there were no prices to record. `runSequence` had all
 * of them in hand the whole time.
 */
export type SequenceStep = {
  r: number;
  risk: number;
  equity: number;
  /** The bar from the level's own trade list, so an entry can be traced back to it. */
  bar: number;
  entry: number;
  stop: number;
  target: number;
  exit: number;
  /** How it ended, in the same words the score card uses. */
  outcome: string;
  label?: string;
};

export type SequenceRun = {
  steps: SequenceStep[];
  startingEquity: number;
  ruined: boolean;
  /** Indices where risk went up after a losing trade. */
  escalations: number[];
  /** Equity at the end, as a fraction of where it started. */
  finalFraction: number;
};

/**
 * Runs the sequence at the player's sizes.
 *
 * Each trade's R comes from `simulate` over the committed series, so the outcomes cannot drift
 * from what the data did — the same reasoning `predict-next` and `sizing-calc` use for deriving
 * rather than authoring their answers.
 *
 * Compounding is multiplicative, which is the point: risking a fraction of a *shrinking* account
 * is what makes a losing streak survivable, and risking a fraction of the original would quietly
 * remove the lesson.
 */
export function runSequence(
  attempt: Attempt["trade-sequence"],
  level: Level<"trade-sequence">,
  data: Series<string>[],
): SequenceRun {
  const series = data[0];
  const { equity, trades, maxBars } = level.config;
  const steps: SequenceStep[] = [];
  const escalations: number[] = [];

  let account = equity;
  let ruined = false;
  const ruinLine = equity * level.tolerance.ruinBelow;

  trades.forEach((trade, i) => {
    if (!series) return;
    const entry = series.c[trade.bar];
    if (entry === undefined) return;

    const risk = attempt.risks[i] ?? 0;
    const distance = entry - trade.stop;
    const outcome = simulate(
      {
        side: distance > 0 ? "long" : "short",
        stop: trade.stop,
        target:
          distance > 0
            ? entry + distance * trade.targetR
            : entry + distance * trade.targetR,
      },
      series,
      trade.bar,
      maxBars,
    );
    const r = outcome?.r ?? 0;

    // Raising risk after a loss is the martingale, and it is the error that turns a streak into
    // a wiped account. Recorded per trade so the correction can point at the exact decision.
    const previous = steps[i - 1];
    if (previous && previous.r < 0 && risk > previous.risk + 1e-9) escalations.push(i);

    account *= 1 + r * risk;
    if (account <= ruinLine) ruined = true;
    steps.push({
      r,
      risk,
      equity: account,
      bar: trade.bar,
      entry,
      stop: trade.stop,
      target:
        distance > 0
          ? entry + distance * trade.targetR
          : entry + distance * trade.targetR,
      exit: outcome?.exitPrice ?? entry,
      outcome: outcome?.reason ?? "not simulated",
      label: trade.label,
    });
  });

  return {
    steps,
    startingEquity: equity,
    ruined,
    escalations,
    finalFraction: equity === 0 ? 0 : account / equity,
  };
}

export function gradeTradeSequence(
  attempt: Attempt["trade-sequence"],
  level: Level<"trade-sequence">,
  data: Series<string>[],
): Grade {
  const run = runSequence(attempt, level, data);
  const count = level.config.trades.length;

  const sized = run.steps.filter((s) => s.risk > 0);
  const restrained = sized.filter(
    (s) => s.risk <= level.tolerance.maxRiskPct + 1e-9,
  ).length;

  const survival = run.ruined ? 0 : 1;
  // An unsized trade is not restraint, it is an unanswered question.
  const restraint = count === 0 ? 0 : restrained / count;
  const consistency = count <= 1 ? 1 : 1 - run.escalations.length / (count - 1);

  const score =
    survival * WEIGHTS.survival +
    restraint * WEIGHTS.restraint +
    Math.max(0, consistency) * WEIGHTS.consistency;

  return {
    score,
    stars: starsFor(score, level.stars, attempt.hintsUsed),
    diagnosis: diagnose(attempt, level, data),
    reference: {
      kind: "sequence",
      steps: run.steps,
      startingEquity: run.startingEquity,
      ruined: run.ruined,
      escalations: run.escalations,
    },
    detail: {
      "account left": `${Math.round(run.finalFraction * 100)}%`,
      "trades sized sanely": `${restrained} of ${count}`,
      "raised risk after a loss": run.escalations.length,
    },
  };
}

/**
 * The attempt a disciplined player would submit: the largest defensible risk, every time.
 *
 * Not the *smallest*, which would also survive — the guard checks that a level's own reference
 * answer earns three stars, and a reference of "risk almost nothing" would pass while teaching
 * that the safest play is not to trade.
 */
/**
 * Ten journal entries, one per trade, all from one attempt.
 *
 * **Every one is `planned: false`.** The entries, stops and targets were authored; the only
 * decision the player made was size. Chapter 9.6's headline figures are computed over planned
 * trades only for exactly this reason — pooling these would make "your average loss is 1.4R,
 * not the 1R you set" a claim about the author's stops rather than the player's, which is the
 * error the chapter exists to cure.
 *
 * `reason` is empty rather than synthesised. The player stated none, and writing "sized at 1%"
 * would put words in their mouth in the one field whose whole value is that it is theirs. 9.6
 * reports "no stated reason" as a real category instead.
 */
export function journalEntriesTradeSequence(
  attempt: Attempt["trade-sequence"],
  level: Level<"trade-sequence">,
  grade: Grade,
): JournalDraft[] {
  if (grade.reference.kind !== "sequence") return [];
  const slice = level.data[0];
  if (!slice) return [];

  return grade.reference.steps.map((step) => ({
    levelId: level.id,
    seriesId: slice.series,
    assetClass: assetClassOf(slice.series),
    entry: step.entry,
    stop: step.stop,
    target: step.target,
    exit: step.exit,
    r: step.r,
    reason: "",
    setup: level.config.setup,
    planned: false,
    tags: ["long", slice.series, `${Math.round(step.risk * 1000) / 10}%`],
  }));
}

export function perfectTradeSequence(
  level: Level<"trade-sequence">,
): Attempt["trade-sequence"] {
  const cap = level.tolerance.maxRiskPct;
  const allowed = level.config.riskChoices.filter((r) => r <= cap + 1e-9);
  const choice = allowed.length > 0 ? Math.max(...allowed) : cap;
  return {
    kind: "trade-sequence",
    risks: level.config.trades.map(() => choice),
    hintsUsed: 0,
  };
}
