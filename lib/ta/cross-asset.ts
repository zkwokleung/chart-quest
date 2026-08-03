import type { Series } from "@/lib/chart/types";
import { correlation } from "./correlation";

/**
 * Comparing markets to each other, which needs a different index from comparing bars.
 *
 * `correlation.ts` answers "are two readings of *this chart* the same reading", indexed by
 * bar, for level 6.5. Chapter 8 asks whether two *markets* move together, indexed by date.
 * That is the transpose with a different key, and giving one function both meanings would
 * leave callers disagreeing about what a row is. The pairwise Pearson helper is imported from
 * there rather than reimplemented; only the indexing is new.
 *
 * ## Why the date key is not `floor(t / 86400000)`
 *
 * Every committed daily bar is stamped at its own market's open, so the six disagree about
 * when a day starts:
 *
 *   BTCUSDT-1d          0.0h  (Binance days are UTC days)
 *   SPY / AAPL / LAKE  13.5h and 14.5h  (EST and EDT)
 *   GC-1d               4.0h and 5.0h, plus a handful of stragglers
 *   EURUSD-1d           0.0h under GMT, but **23.0h under BST** — the previous UTC date
 *
 * Joining on raw `t` returns **zero** rows for any pair. Joining on the UTC calendar day
 * looks correct and is not: it puts 2,759 of the euro's bars one day behind everyone else,
 * which drops them from the intersection and correlates the survivors against the wrong day.
 * The first draft of Chapter 8's plan did exactly that and reported the euro three to five
 * times more correlated with the index than it is.
 *
 * Two hours is the smallest shift that pulls the euro's summer bars onto their own day, and
 * the largest that moves nothing else — no other committed daily series is stamped within two
 * hours of midnight from either side. `cross-asset.test.ts` asserts that, so a new series
 * with an awkward offset fails loudly rather than skewing a matrix.
 *
 * ## Never forward-fill
 *
 * Bitcoin trades weekends and the equities do not. Carrying Friday's SPY close into Saturday
 * to pair it with a real Bitcoin bar would invent a day on which the index did not move, and
 * a zero return against a live one is a correlation the data does not contain. Unmatched days
 * are dropped instead — 2,081 Bitcoin bars become 1,429 aligned ones, and the count travels
 * with the matrix so a reader can see the cost.
 *
 * This is also why variance ratios live in `autocorr.ts` and are computed *before* alignment:
 * a variance ratio is within-asset and must use Bitcoin's own consecutive bars. Aligning first
 * would change what "a one-day return" means for Bitcoin. The two measurements need opposite
 * treatments and the artefact records both.
 */

/** Milliseconds the day key is shifted by. See the module docstring. */
export const DAY_KEY_SHIFT_MS = 2 * 60 * 60 * 1000;

const DAY_MS = 86_400_000;

export type DateWindow = { from: number; to: number };

/** The trading day a bar belongs to, robust to each market's own opening time. */
export function dayKey(t: number): number {
  return Math.floor((t + DAY_KEY_SHIFT_MS) / DAY_MS);
}

export type Aligned = {
  /** Day keys every series has a bar for, ascending. */
  days: number[];
  /** `index[s][k]` is series `s`'s bar index for `days[k]`. */
  index: number[][];
};

/**
 * The bars every series has in common, by date.
 *
 * A day appears only if all of them traded it, which is what makes a row of returns
 * simultaneous rather than merely adjacent.
 */
export function alignByDate(
  series: readonly Series<string>[],
  window?: DateWindow,
): Aligned {
  if (series.length === 0) return { days: [], index: [] };

  const maps = series.map((s) => {
    const m = new Map<number, number>();
    s.t.forEach((t, i) => {
      if (window && (t < window.from || t > window.to)) return;
      // Last bar wins if a market somehow reports two for one day; the alternative is
      // silently correlating a half day against a whole one.
      m.set(dayKey(t), i);
    });
    return m;
  });

  const [first, ...rest] = maps;
  const days = [...first!.keys()]
    .filter((day) => rest.every((m) => m.has(day)))
    .sort((a, b) => a - b);

  return { days, index: maps.map((m) => days.map((day) => m.get(day)!)) };
}

export type AlignedReturns = {
  days: number[];
  /** `r[s][k]` is series `s`'s log return into `days[k + 1]`. */
  r: number[][];
};

/**
 * Log returns between consecutive *aligned* days.
 *
 * Between aligned days, not between adjacent bars: over a weekend the equities' return spans
 * Friday to Monday and Bitcoin's spans the same calendar gap, so the two cover one period.
 * Taking Bitcoin's Friday-to-Saturday return instead would pair three days of index movement
 * against one of crypto.
 */
export function alignedReturns(
  series: readonly Series<string>[],
  window?: DateWindow,
): AlignedReturns {
  const { days, index } = alignByDate(series, window);
  return {
    days,
    r: series.map((s, si) => {
      const out: number[] = [];
      for (let k = 1; k < days.length; k += 1) {
        const previous = s.c[index[si]![k - 1]!]!;
        const current = s.c[index[si]![k]!]!;
        out.push(previous > 0 && current > 0 ? Math.log(current / previous) : 0);
      }
      return out;
    }),
  };
}

export type AssetMatrix = {
  assets: string[];
  /** `rows[i][j]` is the correlation of assets i and j, or null on too small a sample. */
  rows: (number | null)[][];
  /** Aligned days behind every cell. Reported rather than implied. */
  n: number;
};

/**
 * The correlation matrix, optionally over a subset of the aligned days.
 *
 * `keep` receives one day's returns across all assets, so a caller can restrict to crisis
 * days without knowing how the alignment was built — which is what 8.4 needs and what makes
 * "the same book on the days it mattered" one call rather than a reimplementation.
 */
export function returnCorrelation(
  assets: readonly string[],
  aligned: AlignedReturns,
  keep?: (row: readonly number[], dayIndex: number) => boolean,
): AssetMatrix {
  const columns = aligned.r[0]?.length ?? 0;
  const rows: number[][] = aligned.r.map(() => []);
  for (let k = 0; k < columns; k += 1) {
    const day = aligned.r.map((series) => series[k]!);
    if (keep && !keep(day, k)) continue;
    day.forEach((value, s) => rows[s]!.push(value));
  }

  return {
    assets: [...assets],
    rows: rows.map((a, i) =>
      rows.map((b, j) => (i === j ? 1 : correlation(a, b))),
    ),
    n: rows[0]?.length ?? 0,
  };
}

/** Days on which one asset sat in its own worst `fraction`. 8.4's condition. */
export function worstDaysOf(
  aligned: AlignedReturns,
  assetIndex: number,
  fraction: number,
): (row: readonly number[], dayIndex: number) => boolean {
  const own = aligned.r[assetIndex] ?? [];
  const cutoff = [...own].sort((a, b) => a - b)[
    Math.max(0, Math.floor(own.length * fraction) - 1)
  ];
  return (_row, k) => cutoff !== undefined && own[k]! <= cutoff;
}

/** Days in the middle `fraction` of one asset's distribution — the calm-day comparison. */
export function middleDaysOf(
  aligned: AlignedReturns,
  assetIndex: number,
  fraction: number,
): (row: readonly number[], dayIndex: number) => boolean {
  const own = aligned.r[assetIndex] ?? [];
  const sorted = [...own].sort((a, b) => a - b);
  const half = fraction / 2;
  const low = sorted[Math.floor(sorted.length * (0.5 - half))];
  const high = sorted[Math.floor(sorted.length * (0.5 + half))];
  return (_row, k) =>
    low !== undefined && high !== undefined && own[k]! >= low && own[k]! <= high;
}

export type Drawdown = {
  /** Day keys of the peak and the trough. */
  from: number;
  to: number;
  /** The equal-weight book's drawdown, as a negative fraction. */
  book: number;
  /** Each asset's own drawdown across the same span. */
  perAsset: number[];
};

/**
 * The equal-weight book's deepest drawdowns, with what each member did over the same span.
 *
 * The per-asset column is the point: a book that fell 30% while every member fell 30% was
 * never diversified, whatever its average correlations said.
 */
export function jointDrawdowns(
  aligned: AlignedReturns,
  count: number,
): Drawdown[] {
  const columns = aligned.r[0]?.length ?? 0;
  const assets = aligned.r.length;
  if (columns === 0 || assets === 0) return [];

  const equity: number[] = [1];
  for (let k = 0; k < columns; k += 1) {
    let day = 0;
    for (let s = 0; s < assets; s += 1) day += aligned.r[s]![k]!;
    equity.push(equity[k]! * Math.exp(day / assets));
  }

  // Every peak-to-trough run, then the deepest few. Overlapping runs are collapsed by
  // taking the deepest per peak, so one crash does not fill the whole table.
  const found: Drawdown[] = [];
  let peak = 0;
  for (let k = 1; k < equity.length; k += 1) {
    if (equity[k]! >= equity[peak]!) {
      peak = k;
      continue;
    }
    const depth = equity[k]! / equity[peak]! - 1;
    const open = found.at(-1);
    if (open && open.from === aligned.days[peak]) {
      if (depth < open.book) {
        open.book = depth;
        open.to = aligned.days[k]!;
      }
    } else {
      found.push({
        from: aligned.days[peak]!,
        to: aligned.days[k]!,
        book: depth,
        perAsset: [],
      });
    }
  }

  const byKey = new Map(aligned.days.map((day, k) => [day, k]));
  return found
    .sort((a, b) => a.book - b.book)
    .slice(0, count)
    .map((run) => {
      const a = byKey.get(run.from)!;
      const b = byKey.get(run.to)!;
      return {
        ...run,
        perAsset: aligned.r.map((series) => {
          let total = 0;
          for (let k = a; k < b; k += 1) total += series[k]!;
          return Math.exp(total) - 1;
        }),
      };
    });
}
