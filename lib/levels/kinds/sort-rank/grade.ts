import type { Series } from "@/lib/chart/types";
import { diagnose, starsFor, type Grade } from "../../grade";
import type { Attempt, Level } from "../../schema";

/**
 * Scoring an ordering.
 *
 * The question is *how close* the ordering is, not whether it is exact, so a single
 * transposition must not read as total failure. Two orderings differing by one swap
 * near the bottom of five rows have almost all of the insight; scoring on exact
 * position would give them the same mark as a reversal.
 *
 * Kendall's tau is the measure: count the pairs the two orderings disagree about,
 * over the number of pairs there are. It is the number of adjacent swaps needed to
 * turn one list into the other, normalised — which is exactly the quantity
 * `tolerance.swaps` is expressed in, so the author sets a tolerance in a unit they
 * can count on their fingers.
 *
 * Spearman's rank correlation was the alternative and is worse here: it squares
 * distances, so one row misplaced by four positions dominates four rows misplaced by
 * one, and the two cases are not obviously different in what they say about the
 * player's understanding.
 */

/**
 * Discordant pairs between two orderings — the adjacent-swap distance.
 *
 * Requires both lists to hold the same ids; `gradeSortRank` checks that before
 * calling. Ids missing from `submitted` all tie at the end, and ties are concordant,
 * so an incomplete list would otherwise score as agreement about an ordering it never
 * claimed — submitting the first two of five rows measured as perfect.
 */
export function swapDistance(submitted: string[], correct: string[]): number {
  const position = new Map(submitted.map((id, index) => [id, index]));
  const ranked = correct.map(
    (id) => position.get(id) ?? Number.MAX_SAFE_INTEGER,
  );

  let discordant = 0;
  for (let i = 0; i < ranked.length; i += 1) {
    for (let j = i + 1; j < ranked.length; j += 1) {
      if ((ranked[i] ?? 0) > (ranked[j] ?? 0)) discordant += 1;
    }
  }
  return discordant;
}

/** Total pairs in a list of `n` — the worst possible swap distance. */
export function maxSwaps(n: number): number {
  return (n * (n - 1)) / 2;
}

function sameItems(submitted: string[], correct: string[]): boolean {
  if (submitted.length !== correct.length) return false;
  const seen = new Set(submitted);
  return seen.size === correct.length && correct.every((id) => seen.has(id));
}

export function gradeSortRank(
  attempt: Attempt["sort-rank"],
  level: Level<"sort-rank">,
  data: Series<string>[],
): Grade {
  const correct = level.target.order;
  const forgiven = Math.max(0, level.tolerance.swaps);
  const worst = maxSwaps(correct.length);

  // An ordering of some of the rows is not a partial answer, it is not an answer:
  // the unplaced ones would tie at the end and read as agreement. Not reachable
  // through the component, which always submits every row.
  if (!sameItems(attempt.order, correct)) {
    return {
      score: 0,
      stars: 0,
      diagnosis: diagnose(attempt, level, data),
      reference: {
        kind: "ranking",
        submitted: attempt.order,
        correct,
        inPlace: [],
        swaps: worst,
      },
      detail: { "out of order": "the ranking is incomplete" },
    };
  }

  const swaps = swapDistance(attempt.order, correct);

  // Full marks inside the tolerance, then linear down to zero at a fully reversed
  // list. Kendall's tau would run to -1 for a reversal; the score is clamped at 0
  // because "worse than random" is not a distinction the score card can use.
  const score =
    worst === 0
      ? 1
      : swaps <= forgiven
        ? 1
        : Math.max(0, 1 - (swaps - forgiven) / Math.max(worst - forgiven, 1));

  const inPlace = correct.filter((id, index) => attempt.order[index] === id);

  return {
    score,
    stars: starsFor(score, level.stars, attempt.hintsUsed),
    diagnosis: diagnose(attempt, level, data),
    reference: { kind: "ranking", submitted: attempt.order, correct, inPlace, swaps },
    detail: {
      "out of order": swaps === 0 ? "nothing" : `${swaps} pair${swaps === 1 ? "" : "s"}`,
      "in place": `${inPlace.length} of ${correct.length}`,
    },
  };
}

export function perfectSortRank(level: Level<"sort-rank">): Attempt["sort-rank"] {
  return { kind: "sort-rank", order: [...level.target.order], hintsUsed: 0 };
}
