import { statsForRs, UNDERPOWERED_BELOW, type RStats } from "@/lib/journal/analytics";
import type { StrategyRun } from "./engine";

/**
 * What a backtest says, and what it is not big enough to say.
 *
 * **Almost nothing here is new arithmetic, and that is the point.** Expectancy, the win rate with
 * its Wilson interval, the drawdown in R and the worst losing streak were all written and tested in
 * `lib/journal/analytics.ts` for Chapter 9, over exactly the same input — a list of R outcomes in
 * the order they happened. So `statsForRs` is shared rather than copied, and this module adds only
 * the three things a backtest has that a journal does not: the curve, the calendar and the clock.
 *
 * That sharing also let a duplicate go: `edge-sweep.ts` carried its own `drawdownR`, so there were
 * two implementations of one number before M10 and would have been three after it.
 *
 * ## Expectancy is the mean R, and the textbook formula is not computed beside it
 *
 * Inherited from `analytics.ts` and worth repeating where a reader will look for it: every trade
 * the engine takes risks exactly 1R by construction, so `winRate·avgWin − lossRate·avgLoss`
 * **equals** the mean. Computing both would create two sources for one number.
 *
 * ## Every figure travels with its sample size
 *
 * `underpowered` is not a warning bolted on for presentation — it is the reason Chapter 10's
 * objectives can be stated honestly. The out-of-sample holdback cannot produce thirty trades on any
 * daily series in the spine (9 to 33, measured), so a strategy's out-of-sample result can **refute**
 * it and cannot **confirm** it. A report that printed +8.5R over 15 trades without saying so would
 * teach the habit Chapter 9 spent seven levels breaking. The threshold is
 * `UNDERPOWERED_BELOW` from `analytics.ts` rather than a second constant, so the game has one
 * answer to "how many is enough".
 */

export type BacktestMetrics = RStats & {
  /** Cumulative R after each trade, in order. The curve 10.5 draws. */
  equityR: number[];
  /** Total R per calendar year the strategy traded in. */
  byYear: Record<string, number>;
  /** Bars held, summed across trades — the cost side of a rule that trades a lot. */
  barsInMarket: number;
  /** Share of trades whose exit filled past the level asked for, because price gapped. */
  gappedShare: number;
  /**
   * True when the run is too small to conclude from.
   *
   * Reported rather than hidden, and separate from any pass or fail: a strategy can be
   * underpowered and profitable, and saying only "profitable" is the lie.
   */
  underpowered: boolean;
};

export function metricsFor(run: StrategyRun): BacktestMetrics {
  let running = 0;
  const equityR = run.rs.map((r) => (running += r));

  const barsInMarket = run.outcomes.reduce(
    (total, outcome) => total + (outcome.exitBar - outcome.entryBar),
    0,
  );
  const gapped = run.outcomes.filter((outcome) => outcome.gapped).length;

  return {
    ...statsForRs(run.rs),
    equityR,
    byYear: run.byYear,
    barsInMarket,
    gappedShare: run.trades === 0 ? 0 : gapped / run.trades,
    underpowered: run.trades < UNDERPOWERED_BELOW,
  };
}

/** One asset's run, kept apart from every other's. */
export type AssetRun = { asset: string; run: StrategyRun };

export type PerAsset = { asset: string; metrics: BacktestMetrics };

export type PooledMetrics = {
  perAsset: PerAsset[];
  pooled: BacktestMetrics;
  /** Assets whose expectancy cleared zero on a sample large enough to mean it. */
  passing: string[];
  /** Assets that traded too little to say either way — neither passing nor failing. */
  inconclusive: string[];
};

/**
 * Per-asset metrics, with the pooled figures beside them rather than instead of them.
 *
 * **Pooling is offered and never substituted**, which is 8.5's lesson expressed as a return type. A
 * rule making +50R on one market and −10R on three is "profitable pooled", and a report that says
 * only that has hidden its own composition — the exact claim 8.5 asks the player to mark as flawed.
 * So `perAsset` always comes back, and 10.7's objective is stated over it.
 *
 * The pooled sequence is the concatenation in the order given, so its drawdown is the drawdown of
 * trading these markets one after another — which nobody did. A pooled total R is worth having and
 * a pooled drawdown is not, so the field keeps its unit and this comment keeps the caveat.
 *
 * `inconclusive` is a third outcome on purpose. An asset that took eleven trades has not failed,
 * and counting it as a failure would make 10.7's objective depend on how much data a market
 * happens to have rather than on whether the rule travels.
 */
export function poolMetrics(runs: readonly AssetRun[]): PooledMetrics {
  const perAsset = runs.map(({ asset, run }) => ({
    asset,
    metrics: metricsFor(run),
  }));
  const allRs = runs.flatMap(({ run }) => run.rs);

  const pooled: BacktestMetrics = {
    ...statsForRs(allRs),
    equityR: cumulativeOf(allRs),
    byYear: runs.reduce<Record<string, number>>((total, { run }) => {
      for (const [year, r] of Object.entries(run.byYear)) {
        total[year] = (total[year] ?? 0) + r;
      }
      return total;
    }, {}),
    barsInMarket: perAsset.reduce((t, e) => t + e.metrics.barsInMarket, 0),
    gappedShare:
      allRs.length === 0
        ? 0
        : runs.flatMap(({ run }) => run.outcomes).filter((o) => o.gapped).length /
          allRs.length,
    underpowered: allRs.length < UNDERPOWERED_BELOW,
  };

  return {
    perAsset,
    pooled,
    passing: perAsset
      .filter((e) => !e.metrics.underpowered && (e.metrics.expectancy ?? 0) > 0)
      .map((e) => e.asset),
    inconclusive: perAsset.filter((e) => e.metrics.underpowered).map((e) => e.asset),
  };
}

function cumulativeOf(rs: readonly number[]): number[] {
  let running = 0;
  return rs.map((r) => (running += r));
}
