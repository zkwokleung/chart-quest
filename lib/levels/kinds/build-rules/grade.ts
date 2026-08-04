import { compileEntry, warmupFor } from "@/lib/backtest/blocks";
import { runStrategy, type StrategySpec } from "@/lib/backtest/engine";
import { scoreObjective, type ObjectiveResult } from "@/lib/backtest/guards";
import type { AssetRun } from "@/lib/backtest/metrics";
import type { Series } from "@/lib/chart/types";
import { diagnose, starsFor, type Grade } from "../../grade";
import type { Attempt, ExitRule, Level, RiskRule } from "../../schema";

/**
 * Scoring a strategy the player built.
 *
 * ## The strategy is the attempt, and that is what keeps this pure
 *
 * Chapter 10 promises the player composes something of their own, and `CONVENTIONS.md` holds that no
 * level's graded answer may depend on the store. Both are satisfied by carrying the blocks on the
 * attempt: this function receives the whole strategy as an argument, runs it over the series the
 * level names, and reads its verdict off the result. It touches no store, no clock and no cache, so
 * the authoring guards can run it over every authored level in a second — exactly as they do the
 * other twelve graders.
 *
 * `predict-next` is the precedent for the shape: no authored answer, because the answer is whatever
 * the data did. Here the run is what the data did.
 *
 * ## The score is the objective, not a distance from a reference
 *
 * There is no "correct" strategy, so `target.reference` is never compared against. It exists to give
 * `perfectAttempt` something to return, which is what lets the winnability guard prove three stars
 * is reachable. `annotate` made the same call about trendlines for the same reason: many answers are
 * defensible, and marking against one author's would teach guessing the author.
 *
 * What the score *is*: how far the run got toward the objective, on a scale the objective itself
 * defines. A refuted strategy scores what it earned rather than zero, because a player who built a
 * rule that traded honestly and lost has done most of the work of Chapter 10 — the part that is
 * hard is stating the rule and reading the result, and only the second half of that went wrong.
 */

export type StrategyGrade = Grade & {
  reference: Extract<Grade["reference"], { kind: "run" }>;
};

/** Builds the engine spec a strategy asks for, filling in whatever the level fixed. */
export function specFrom(
  attempt: Pick<Attempt["build-rules"], "entry" | "exit" | "risk">,
  level: Level<"build-rules">,
): StrategySpec {
  const exit: ExitRule = level.config.fixed?.exit ?? attempt.exit;
  return {
    entry: compileEntry(attempt.entry),
    side: level.config.fixed?.side ?? "long",
    stop: { kind: "atr", multiple: exit.stopAtr },
    target: exit.targetR === null ? { kind: "none" } : { kind: "r", multiple: exit.targetR },
    timeStopBars: exit.timeStopBars,
    warmup: warmupFor(attempt.entry),
  };
}

/**
 * One run per series the level names, kept apart.
 *
 * `level.data` is a list of slices and each is its own market, so the runs are per slice rather than
 * pooled — which is what makes 10.7's objective expressible at all. The slice's own `from`/`to` is
 * the window, so a level can hold data back simply by not naming it.
 */
export function runsFor(
  attempt: Pick<Attempt["build-rules"], "entry" | "exit" | "risk">,
  level: Level<"build-rules">,
  data: Series<string>[],
): AssetRun[] {
  const spec = specFrom(attempt, level);
  const wantsBaseline = level.config.objective.beatBaseline === true;
  // The same exit with no entry condition at all — what the market and the exit would have paid on
  // their own. Run over the identical window, or the comparison is between two different questions.
  const baselineSpec: StrategySpec = { ...spec, entry: () => true };

  return level.data.flatMap((slice, i) => {
    const series = data[i];
    if (!series) return [];
    const window = { from: Math.max(slice.from, spec.warmup), to: slice.to };
    return [
      {
        asset: slice.series,
        run: runStrategy(series, spec, window),
        ...(wantsBaseline
          ? { baseline: runStrategy(series, baselineSpec, window) }
          : {}),
      },
    ];
  });
}

/**
 * How much of the objective a run reached, in [0, 1].
 *
 * Three components rather than a single pass/fail, because a boolean score would make every star
 * threshold meaningless and would tell a player who nearly cleared the bar the same thing it tells
 * one who never traded:
 *
 * - **Did it trade enough to say anything** — the sample-size half of Chapter 9, and the first thing
 *   a reader should check. Capped at 1, so a rule taking 300 trades earns nothing extra for volume.
 * - **Did it make money per trade**, scaled so a small positive expectancy is most of the marks.
 *   Chapter 9.1's lesson: +0.146R over 24 trades is a business, and a scale that only rewarded +1R
 *   would teach the opposite.
 * - **Did it travel** — the share of the required asset classes that cleared it. Zero when the
 *   objective asks for none.
 */
export function scoreOf(result: ObjectiveResult, level: Level<"build-rules">): number {
  const { objective } = level.config;
  const minTrades = objective.minTrades ?? 20;
  const needClasses = objective.minClassesPassing ?? 0;
  const needAssets = objective.minAssetsPassing ?? 1;

  const traded = Math.min(
    1,
    result.metrics.perAsset.reduce((total, entry) => total + entry.metrics.n, 0) /
      (minTrades * Math.max(1, needAssets)),
  );

  const expectancy = result.metrics.pooled.expectancy ?? 0;
  // Half a mark at break-even, full marks at +0.5R a trade. A rule that loses scores below half
  // rather than zero: it traded, and the reading of it is the other half of the level.
  const paid = Math.max(0, Math.min(1, 0.5 + expectancy));

  const travelled =
    needClasses === 0
      ? Math.min(1, result.passing.length / needAssets)
      : Math.min(1, result.classesPassing.length / needClasses);

  return traded * 0.25 + paid * 0.35 + travelled * 0.4;
}

export function gradeBuildRules(
  attempt: Attempt["build-rules"],
  level: Level<"build-rules">,
  data: Series<string>[],
): Grade {
  const runs = runsFor(attempt, level, data);
  const result = scoreObjective(runs, level.config.objective);
  const score = scoreOf(result, level);

  return {
    score,
    stars: starsFor(score, level.stars, attempt.hintsUsed),
    diagnosis: diagnose(attempt, level, data),
    reference: {
      kind: "run",
      verdict: result.verdict,
      reason: result.reason,
      perAsset: result.metrics.perAsset.map((entry) => ({
        asset: entry.asset,
        trades: entry.metrics.n,
        expectancy: entry.metrics.expectancy,
        totalR: entry.metrics.totalR,
        maxDrawdownR: entry.metrics.maxDrawdownR,
        underpowered: entry.metrics.underpowered,
        // Shown beside the player's own figure, always. A rule that made +0.23R next to a market
        // that paid +0.27R for nothing has found nothing, and the only way to know is to see both.
        baselineR:
          result.baselines.find((b) => b.asset === entry.asset)?.perTradeR ?? null,
      })),
      passing: result.passing,
      classesPassing: [...result.classesPassing],
      equityR: result.metrics.pooled.equityR,
    },
    detail: {
      verdict: result.verdict,
      trades: result.metrics.pooled.n,
      expectancy: Number((result.metrics.pooled.expectancy ?? 0).toFixed(3)),
      "markets passing": `${result.passing.length} of ${result.metrics.perAsset.length}`,
    },
  };
}

const DEFAULT_EXIT: ExitRule = { stopAtr: 2, targetR: 2, timeStopBars: 60 };
const DEFAULT_RISK: RiskRule = { perTradePct: 0.01 };

/**
 * The author's own strategy, which the winnability guard runs.
 *
 * Returns `target.reference` verbatim rather than deriving anything: the point is that the author
 * committed to a strategy in the level file and CI checks it clears the objective there. A level
 * whose reference does not is unwinnable, and finding that out in CI rather than from a stuck player
 * is the whole value of the guard.
 */
export function perfectBuildRules(
  level: Level<"build-rules">,
): Attempt["build-rules"] {
  const { reference } = level.target;
  return {
    kind: "build-rules",
    entry: reference.entry,
    exit: reference.exit ?? DEFAULT_EXIT,
    risk: reference.risk ?? DEFAULT_RISK,
    variants: 1,
    hintsUsed: 0,
  };
}
