import { assetClassOf, type AssetClass } from "@/lib/instruments/asset-class";
import { UNDERPOWERED_BELOW } from "@/lib/journal/analytics";
import type { AssetRun, PooledMetrics } from "./metrics";
import { poolMetrics } from "./metrics";

/**
 * The three things that stop a backtest certifying an overfit strategy as finished work.
 *
 * Every one is a pure function over runs the engine already produced. Nothing here reads a store or
 * a clock — the variant counter takes the count rather than looking it up — because these are the
 * checks Chapter 10 grades on and no level's graded answer may depend on the store.
 *
 * ## Why "inconclusive" is a third outcome
 *
 * **The measurement that shaped this module.** The out-of-sample holdback cannot produce thirty
 * trades on any daily series in the spine: 9 on Bitcoin, 21 on the index, 33 on gold at its most
 * generous lookback, against 39 to 166 in-sample. A holdback that size can **refute** a strategy and
 * cannot **confirm** one, and a guard that returned only pass or fail would have to lie in one
 * direction or the other. So a small sample comes back labelled, and Chapter 10.6 is built on the
 * asymmetry rather than pretending it away.
 *
 * That is also why a strategy is never "validated" here. `refuted` is a verdict the data can carry;
 * "confirmed" is not, and the vocabulary refuses to offer it.
 */

/** Where the in-sample window ends and the held-back one begins. */
export const IN_SAMPLE_FRACTION = 0.7;

/**
 * Variants past which tuning is the thing being measured.
 *
 * Ten because 9.5 swept twenty-six lookbacks and the best in-sample setting placed 25th of 26
 * later. The player has already been shown what a sweep costs; this is the reminder while they do
 * it to their own rule. A warning rather than a block: refusing the eleventh attempt would teach
 * that tuning is forbidden rather than that it is expensive.
 */
export const VARIANT_WARNING_AT = 10;

export type SplitWindows = {
  inSample: { from: number; to: number };
  later: { from: number; to: number };
  /** The bar the split falls on, so a level can say where it is. */
  splitBar: number;
};

/**
 * The forced split of one series.
 *
 * Forced in the sense that a level asks for windows rather than choosing them: a player who could
 * pick their own boundary would pick the one that flattered the result, which is 9.5's lesson with
 * an extra step. `warmup` is passed in because the in-sample window must start where the strategy
 * can actually produce a signal, and a split that ignores it silently shortens the tuning window.
 */
export function splitOf(
  bars: number,
  warmup: number,
  fraction = IN_SAMPLE_FRACTION,
): SplitWindows {
  const splitBar = Math.floor(bars * fraction);
  return {
    inSample: { from: warmup, to: splitBar },
    later: { from: splitBar, to: bars },
    splitBar,
  };
}

export type Verdict = "passed" | "refuted" | "inconclusive";

export type ObjectiveResult = {
  verdict: Verdict;
  /** Assets whose expectancy cleared zero on a sample large enough to mean it. */
  passing: string[];
  /** Assets whose expectancy was negative on a sample large enough to mean it. */
  failing: string[];
  /** Assets that traded too little to say either way. */
  inconclusive: string[];
  /** Distinct asset classes among the passing ones — what 10.7 is actually about. */
  classesPassing: AssetClass[];
  metrics: PooledMetrics;
  /** Said in words, because a verdict without its reason teaches nothing. */
  reason: string;
};

export type Objective = {
  /** Expectancy each asset must beat. Zero unless a level asks for more. */
  minExpectancy?: number;
  /** Trades an asset needs before its result counts. Defaults to the journal's threshold. */
  minTrades?: number;
  /** How many assets must clear it. */
  minAssetsPassing?: number;
  /** How many *distinct asset classes* must clear it. 10.7's real objective. */
  minClassesPassing?: number;
};

/**
 * Scores a set of per-asset runs against an objective.
 *
 * **Stated over per-asset results, never over the pooled total**, which is the whole of 10.7 and
 * 8.5's flawed claim inverted: "profitable on all six, so the edge is in the rule" is what a pooled
 * objective rewards, and per-trade R spreads fiftyfold across this spine. A strategy that makes
 * +50R on Bitcoin and −10R on three other markets must not pass a cross-asset test.
 */
export function scoreObjective(
  runs: readonly AssetRun[],
  objective: Objective,
): ObjectiveResult {
  const minExpectancy = objective.minExpectancy ?? 0;
  const minTrades = objective.minTrades ?? UNDERPOWERED_BELOW;
  const metrics = poolMetrics(runs);

  const enough = metrics.perAsset.filter((entry) => entry.metrics.n >= minTrades);
  const passing = enough
    .filter((entry) => (entry.metrics.expectancy ?? 0) > minExpectancy)
    .map((entry) => entry.asset);
  const failing = enough
    .filter((entry) => (entry.metrics.expectancy ?? 0) <= minExpectancy)
    .map((entry) => entry.asset);
  const inconclusive = metrics.perAsset
    .filter((entry) => entry.metrics.n < minTrades)
    .map((entry) => entry.asset);

  const classesPassing = [
    ...new Set(passing.map((asset) => assetClassOf(asset as never))),
  ];

  const needAssets = objective.minAssetsPassing ?? 1;
  const needClasses = objective.minClassesPassing ?? 0;
  const met = passing.length >= needAssets && classesPassing.length >= needClasses;

  // **The order of these three branches is the module's argument.** A strategy that met the
  // objective passed, whatever else is inconclusive. One that failed on a real sample is refuted —
  // a verdict the data can carry. Everything else is inconclusive, and calling that a failure would
  // make the objective a measure of how much history a market happens to have.
  const verdict: Verdict = met
    ? "passed"
    : failing.length > 0 && inconclusive.length === 0
      ? "refuted"
      : "inconclusive";

  return {
    verdict,
    passing,
    failing,
    inconclusive,
    classesPassing,
    metrics,
    reason: reasonFor({
      verdict,
      passing,
      failing,
      inconclusive,
      needAssets,
      needClasses,
      classesPassing,
      minTrades,
    }),
  };
}

function reasonFor(args: {
  verdict: Verdict;
  passing: string[];
  failing: string[];
  inconclusive: string[];
  needAssets: number;
  needClasses: number;
  classesPassing: AssetClass[];
  minTrades: number;
}): string {
  const { verdict, passing, failing, inconclusive, needAssets, needClasses } = args;

  if (verdict === "passed") {
    const classes =
      needClasses > 0
        ? ` across ${args.classesPassing.length} asset ${
            args.classesPassing.length === 1 ? "class" : "classes"
          }`
        : "";
    return `Positive expectancy on ${passing.length} of ${
      passing.length + failing.length + inconclusive.length
    } markets${classes}.`;
  }

  if (verdict === "refuted") {
    return `Negative expectancy on ${failing.join(", ")}, over enough trades to mean it. That is a real result rather than a small sample.`;
  }

  const short = inconclusive.length;
  const need =
    needClasses > 0
      ? `${needAssets} markets across ${needClasses} asset classes`
      : `${needAssets} markets`;
  return `Too little to say. ${short} of ${
    passing.length + failing.length + short
  } markets took fewer than ${args.minTrades} trades, and the objective asks for ${need}. A sample this size can rule a strategy out; it cannot rule one in.`;
}

export type VariantWarning = {
  count: number;
  warn: boolean;
  message: string | null;
};

/**
 * What to say to a player on their nth variant.
 *
 * Takes the count rather than reading it, so this stays pure and a grader may call it. The message
 * is deliberately about *cost* rather than about rules: a player who stops tuning because a warning
 * told them to has learned to obey a warning, and one who keeps going with the 25th-of-26 figure in
 * mind has learned what tuning buys.
 */
export function variantWarning(count: number): VariantWarning {
  if (count < VARIANT_WARNING_AT) return { count, warn: false, message: null };
  return {
    count,
    warn: true,
    message: `This is variant ${count}. In 9.5 the best of twenty-six settings placed 25th of 26 on the years it was not chosen on — every variant you try makes the best one you find a little more likely to be the luckiest rather than the truest. Nothing stops you; the cost is just no longer nothing.`,
  };
}
