import type { AssetClass } from "@/lib/instruments/asset-class";
import type { JournalEntry } from "@/lib/store/schema";
import { wilsonInterval } from "@/lib/ta/base-rates";

/**
 * What the player's own trade record says, and what it is not big enough to say.
 *
 * Pure, and deliberately not in `lib/store/`. Analytics over the journal is computation rather
 * than store code, so it takes the entries as an argument and reads nothing ambient — which is
 * also what makes it the cheapest thing in the project to test.
 *
 * ## Planned trades are what every headline rests on
 *
 * Ten of the seventeen entries a full playthrough writes come from 7.B, where the entry, the
 * stop and the target were authored and the only decision was size. Reporting a pooled "average
 * loss" over those would describe *the author's* stops, which is precisely the error Chapter 9
 * exists to cure. So `planned` is reported separately and `all` exists to be shown rather than
 * headlined.
 *
 * ## Expectancy is the mean R, and the textbook formula is not computed beside it
 *
 * Every trade here risks exactly 1R by construction of `simulate`, so
 * `winRate·avgWin − lossRate·avgLoss` **equals** the mean R. Computing both would create two
 * sources for one number and a way for them to disagree, which is the drift this codebase
 * spends most of its comments avoiding.
 *
 * ## Max drawdown is in R, over the cumulative curve, and says so
 *
 * There is no equity curve to draw one from: the trades come from eight levels with different
 * notional accounts and are sequential in none of them. An unlabelled "max drawdown" invites
 * reading as a percentage of an account that never existed, so the unit is in the field name.
 *
 * ## Underpowered cells are named rather than left to be noticed
 *
 * The largest planned per-asset-class cell a player can reach is four trades. A per-class
 * expectancy from four trades is the sample-size fallacy of 9.2 turned on the player, and the
 * report's job is to say so out loud rather than to print a confident-looking number. That is
 * the whole reason 9.6 can be graded: the honest reading is the same for everybody.
 */

/** Below this, a cell cannot support a conclusion. `base-rates.json` calls n=34 "the lesson". */
export const UNDERPOWERED_BELOW = 20;

/**
 * What a list of R outcomes says, whoever produced them.
 *
 * Split out from `JournalStats` in M10 so the backtester and the journal share one arithmetic.
 * `lib/backtest/metrics.ts` needs expectancy, the win rate with its interval, the drawdown and
 * the worst losing streak over trades that came from the engine rather than from the player, and
 * every one of those was already written and tested here. A second copy would have been a second
 * answer — and there were already two drawdowns in the codebase before this, one of which this
 * change deletes.
 */
export type RStats = {
  n: number;
  wins: number;
  /** A trade that ran out of bars can land at exactly 0.00R. Rare, real, and not a win. */
  scratches: number;
  losses: number;
  winRate: number | null;
  /** Wilson score interval, as `base-rates.ts` uses. Null under three trades. */
  winRateCi95: [number, number] | null;
  /** Mean R. See the note above on why this *is* the expectancy. */
  expectancy: number | null;
  avgWinR: number | null;
  avgLossR: number | null;
  totalR: number;
  /** Deepest peak-to-trough of the cumulative R curve, in R, reported positive. */
  maxDrawdownR: number;
  worstLosingStreak: number;
};

/** `RStats` plus the one thing only a journal knows: who chose the plan. */
export type JournalStats = RStats & {
  /** Of `n`, how many had their entry, stop and target chosen by the player. */
  planned: number;
};

export type JournalCell = {
  key: string;
  label: string;
  stats: JournalStats;
  /** True when the cell is too small to conclude from. */
  underpowered: boolean;
};

export type JournalReport = {
  /** Trades the player planned. Every headline claim uses this. */
  planned: JournalStats;
  /** Everything, including trades whose plan was authored. Shown, never headlined. */
  all: JournalStats;
  byAssetClass: JournalCell[];
  bySetup: JournalCell[];
  bySeries: JournalCell[];
  discipline: {
    /** Trades that lost more than a full R, which means a gap took the stop. */
    gapped: number;
    /** How much worse the average loss was than the 1R the stop promised. */
    excessLossR: number | null;
    /** Trades with no stated reason — every sequence trade, by design. */
    unreasoned: number;
    /** Levels attempted more than once, which is a habit rather than a failing. */
    retried: number;
  };
  /** Labels of every cell too small to conclude from. */
  underpowered: string[];
};

const isPlanned = (entry: JournalEntry) => entry.planned !== false;

/** Entries with a usable R, oldest first. Anything else cannot be counted. */
function usable(journal: readonly JournalEntry[]): JournalEntry[] {
  return journal
    .filter((e) => typeof e.r === "number" && Number.isFinite(e.r))
    .sort((a, b) => a.at.localeCompare(b.at));
}

const mean = (xs: number[]): number | null =>
  xs.length === 0 ? null : xs.reduce((t, x) => t + x, 0) / xs.length;

/**
 * The statistics of a run of R outcomes, in the order they happened.
 *
 * **Order matters and is the caller's responsibility.** The drawdown and the losing streak are
 * properties of a sequence rather than of a set, so handing this a shuffled list produces numbers
 * that are arithmetically correct and mean nothing. `statsFor` sorts by `at` before calling;
 * the engine's `rs` are already in trade order.
 */
export function statsForRs(rs: readonly number[]): RStats {
  const wins = rs.filter((r) => r > 0);
  const losses = rs.filter((r) => r < 0);
  const scratches = rs.filter((r) => r === 0);

  // Peak-to-trough of the running total, in R. Zero for a curve that only rises.
  let running = 0;
  let peak = 0;
  let deepest = 0;
  let streak = 0;
  let worstStreak = 0;
  for (const r of rs) {
    running += r;
    peak = Math.max(peak, running);
    deepest = Math.min(deepest, running - peak);
    streak = r < 0 ? streak + 1 : 0;
    worstStreak = Math.max(worstStreak, streak);
  }

  const decided = wins.length + losses.length;
  return {
    n: rs.length,
    wins: wins.length,
    losses: losses.length,
    scratches: scratches.length,
    winRate: decided === 0 ? null : wins.length / decided,
    // Three is the smallest sample an interval says anything about; below it the interval is
    // the whole [0, 1] range and printing it implies more than it contains.
    winRateCi95: decided < 3 ? null : wilsonInterval(wins.length, decided),
    expectancy: mean([...rs]),
    avgWinR: mean(wins),
    avgLossR: mean(losses),
    totalR: rs.reduce((t, r) => t + r, 0),
    maxDrawdownR: Math.abs(deepest),
    worstLosingStreak: worstStreak,
  };
}

export function statsFor(entries: readonly JournalEntry[]): JournalStats {
  return {
    ...statsForRs(entries.map((e) => e.r as number)),
    planned: entries.filter(isPlanned).length,
  };
}

function groupBy(
  entries: readonly JournalEntry[],
  key: (e: JournalEntry) => string,
  label: (k: string) => string,
): JournalCell[] {
  const groups = new Map<string, JournalEntry[]>();
  for (const entry of entries) {
    const k = key(entry);
    groups.set(k, [...(groups.get(k) ?? []), entry]);
  }
  return [...groups.entries()]
    .map(([k, group]) => {
      const stats = statsFor(group);
      return {
        key: k,
        label: label(k),
        stats,
        underpowered: stats.n < UNDERPOWERED_BELOW,
      };
    })
    .sort((a, b) => b.stats.n - a.stats.n || a.key.localeCompare(b.key));
}

const CLASS_LABELS: Record<string, string> = {
  "crypto-spot": "Crypto",
  equity: "Shares",
  fx: "Currencies",
  futures: "Futures",
};

const SETUP_LABELS: Record<string, string> = {
  continuation: "Continuation",
  reversal: "Reversal",
  level: "At a level",
};

export function reportOn(journal: readonly JournalEntry[]): JournalReport {
  const entries = usable(journal);
  const planned = entries.filter(isPlanned);

  const byAssetClass = groupBy(
    planned,
    (e) => e.assetClass,
    (k) => CLASS_LABELS[k] ?? k,
  );
  const bySetup = groupBy(
    planned,
    (e) => e.setup ?? "unlabelled",
    (k) => SETUP_LABELS[k] ?? "Unlabelled",
  );
  const bySeries = groupBy(
    planned,
    (e) => e.seriesId,
    (k) => k,
  );

  const losses = planned.map((e) => e.r as number).filter((r) => r < 0);
  const avgLoss = mean(losses);

  const attempts = new Set(
    entries.map((e) => `${e.levelId}#${e.attemptNo ?? 0}`),
  );

  return {
    planned: statsFor(planned),
    all: statsFor(entries),
    byAssetClass,
    bySetup,
    bySeries,
    discipline: {
      // Below −1R means the stop did not hold — a gap took it, which 1.6 taught and 7.B's last
      // trade cost money on.
      gapped: planned.filter((e) => (e.r as number) < -1.0001).length,
      excessLossR: avgLoss === null ? null : Math.max(0, -avgLoss - 1),
      unreasoned: entries.filter((e) => e.reason.trim().length === 0).length,
      retried: attempts.size - new Set(entries.map((e) => e.levelId)).size,
    },
    // Named from the two breakdowns a player would actually reason from. Every by-series cell
    // is underpowered by construction — seven planned trades spread over five markets — so
    // listing them would bury the two that matter under five that were never in question.
    underpowered: [...byAssetClass, ...bySetup]
      .filter((cell) => cell.underpowered)
      .map((cell) => cell.label),
  };
}

/**
 * The one radar axis that measures behaviour rather than answers.
 *
 * Three things the journal can see and a level score cannot: whether the player wrote down why,
 * whether their losses stayed inside the risk they set, and whether they retried a level until
 * it worked. Null on an empty record, because a score of zero would read as a failing rather
 * than as an absence.
 */
export function disciplineScore(
  journal: readonly JournalEntry[],
): number | null {
  const entries = usable(journal).filter(isPlanned);
  if (entries.length === 0) return null;

  const reasoned =
    entries.filter((e) => e.reason.trim().length >= 15).length / entries.length;

  const losses = entries.map((e) => e.r as number).filter((r) => r < 0);
  // A loss worse than 1R is a gap rather than a decision, so held is capped at 1 rather than
  // punishing a player for something a stop cannot prevent.
  const held = losses.length === 0 ? 1 : Math.min(1, 1 / Math.max(1, -mean(losses)!));

  const levels = new Set(entries.map((e) => e.levelId)).size;
  const attempts = new Set(
    entries.map((e) => `${e.levelId}#${e.attemptNo ?? 0}`),
  ).size;
  const firstTime = levels === 0 ? 1 : levels / Math.max(levels, attempts);

  return (reasoned + held + firstTime) / 3;
}
