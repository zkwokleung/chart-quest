import type { Series } from "@/lib/chart/types";
import { atr } from "@/lib/ta/atr";
import { simulate, type TradeOutcome, type TradeSide } from "@/lib/trade/simulate";

/**
 * One rule over one series, taken in sequence.
 *
 * ## Why this is a generalisation rather than a new engine
 *
 * Two things that walk a rule through bars already existed when Chapter 10 started.
 * `lib/trade/simulate.ts` resolves a single trade's fills — no look-ahead, a gap past the stop
 * filling at the open, a bar containing both stop and target scoring as a stop. And `runEdge` in
 * `lib/ta/edges.ts` was already a sequential backtester: warmup, no overlapping positions,
 * per-trade R, per-year totals. It feeds **both** committed measurement artefacts,
 * `asset-character.json` and `edge-sweep.json`, whose numbers are quoted by 8.3, 8.5, 8.6, 8.B,
 * 9.3, 9.5 and 9.B.
 *
 * A third loop here would have disagreed with those quietly — in the fifth decimal, on gapped
 * bars — and this project's central claim is that every number it shows is recomputable. So this
 * is `runEdge`'s loop with the fixed parts made parameters, and `runEdge` is now an adapter over
 * it. The gate on that refactor was not a passing test suite but a **byte-identical artefact
 * diff**: `npm run data:character && npm run data:sweep` must leave `public/data/` unchanged.
 *
 * ## What it does not do
 *
 * No position sizing and no currency. Everything here is in R, because R is what makes a result
 * comparable across markets — the same reason Chapter 7 is built on it. `InstrumentSpec` turns an
 * R into a number of contracts at the point a player is asked to trade, which is level 10.4's
 * subject and not this module's.
 *
 * Sequential, with no overlapping positions, because that is what a person could have done — and
 * because overlapping entries count the same move several times. That difference is why Chapter 6
 * and Chapter 7 once reported different hit rates for what looked like one rule.
 */

/** How a strategy decides where the stop goes. ATR-relative, so a rule is portable by construction. */
export type StopRule = {
  kind: "atr";
  multiple: number;
  /** ATR lookback. 14 unless a strategy says otherwise. */
  period?: number;
};

/** Where the target goes, as a multiple of the risk taken. `none` runs to the stop or the clock. */
export type TargetRule = { kind: "r"; multiple: number } | { kind: "none" };

export type StrategySpec = {
  /**
   * True when bar `i` triggers an entry.
   *
   * **Must read `i` and earlier only.** The engine cannot enforce that — a predicate is a
   * function — so it is enforced two ways instead: `blocks.ts` compiles predicates that cannot
   * reach forward, and this module's prefix-invariance test proves that truncating the series
   * leaves every already-closed trade identical. A predicate that peeked would fail it.
   */
  entry: (series: Series<string>, i: number) => boolean;
  side: TradeSide;
  stop: StopRule;
  target: TargetRule;
  /** Bars a position may stay open before it is closed at the market. */
  timeStopBars: number;
  /**
   * Bars of history required before the first possible signal.
   *
   * Not derived here, because only the rule knows what it needs: a 200-bar average produces a
   * number after two hundred bars and nonsense before them. `warmupFor` in `blocks.ts` computes
   * it from a composed strategy; `runEdge` passes the 210 Chapter 8 fixed for all four of its
   * rules.
   */
  warmup: number;
};

export type StrategyRun = {
  /** Each trade's R, in order. */
  rs: number[];
  trades: number;
  totalR: number;
  perTradeR: number;
  /** Share of trades that reached the target. Zero when the strategy has none. */
  hitRate: number;
  /** Total R per calendar year the rule traded in, keyed by year. */
  byYear: Record<string, number>;
  /**
   * Every trade in full, which `EdgeResult` throws away.
   *
   * 10.5 draws an equity curve and 10.B tabulates the trades; rebuilding either from `rs` would
   * have lost the entry and exit prices, so the loop keeps what it already had in hand.
   */
  outcomes: TradeOutcome[];
};

const DEFAULT_ATR_PERIOD = 14;

/**
 * A trade counts as having reached its target at this tolerance below it.
 *
 * Chapter 8's figure, preserved exactly. It is a tolerance rather than a test of
 * `reason === "target"` because a gap through the target exits *above* it and a trade closed by
 * the clock can land just under it, and the artefacts were computed this way. Switching to the
 * exit reason would be defensible and would move published numbers, so it is not this step's
 * change to make.
 */
const TARGET_TOLERANCE = 0.1;

export function runStrategy(
  series: Series<string>,
  spec: StrategySpec,
  window?: { from: number; to: number },
): StrategyRun {
  const rs: number[] = [];
  const outcomes: TradeOutcome[] = [];
  const byYear: Record<string, number> = {};

  const long = spec.side === "long";
  const period = spec.stop.period ?? DEFAULT_ATR_PERIOD;

  let cursor = Math.max(spec.warmup, window?.from ?? spec.warmup);
  const end = Math.min(
    series.c.length - spec.timeStopBars - 1,
    window?.to ?? Infinity,
  );

  while (cursor < end) {
    const volatility = atr(series, cursor, period);
    if (volatility <= 0 || !spec.entry(series, cursor)) {
      cursor += 1;
      continue;
    }

    const entry = series.c[cursor]!;
    const risk = volatility * spec.stop.multiple;
    const stop = long ? entry - risk : entry + risk;
    const target =
      spec.target.kind === "r"
        ? long
          ? entry + risk * spec.target.multiple
          : entry - risk * spec.target.multiple
        : null;

    const outcome = simulate(
      { side: spec.side, stop, target },
      series,
      cursor,
      spec.timeStopBars,
    );
    // A plan that cannot be simulated is a planning error rather than a losing trade, so it is
    // skipped rather than counted as one. `simulate` returns null for a zero-width risk, which
    // an ATR of zero would produce — already excluded above, but not only there.
    if (!outcome) {
      cursor += 1;
      continue;
    }

    rs.push(outcome.r);
    outcomes.push(outcome);
    const year = String(new Date(series.t[cursor]!).getUTCFullYear());
    byYear[year] = (byYear[year] ?? 0) + outcome.r;
    cursor = outcome.exitBar + 1;
  }

  const totalR = rs.reduce((total, r) => total + r, 0);
  const reachedTarget =
    spec.target.kind === "r" ? spec.target.multiple - TARGET_TOLERANCE : Infinity;

  return {
    rs,
    trades: rs.length,
    totalR,
    perTradeR: rs.length === 0 ? 0 : totalR / rs.length,
    hitRate:
      rs.length === 0
        ? 0
        : rs.filter((r) => r >= reachedTarget).length / rs.length,
    byYear,
    outcomes,
  };
}
