import type { Series } from "@/lib/chart/types";
import type {
  Attempt,
  DiagnosisEntry,
  Level,
  LevelKind,
  OverlaySpec,
  StarThresholds,
} from "./schema";

export type Stars = 0 | 1 | 2 | 3;

export type Grade = {
  /** 0..1 */
  score: number;
  stars: Stars;
  /** Matched misconceptions, in author order — narrow tests declared first. */
  diagnosis: DiagnosisEntry[];
  /** How to show the correction against the player's own attempt. */
  reference: OverlaySpec;
  /** Free-form per-kind detail for the score card, e.g. accuracy on 1.B. */
  detail?: Record<string, number | string>;
};

/**
 * Stars from a score, capped by hints taken.
 *
 * The cap is the whole reason hints are not free: each one consumed removes a
 * star from reach. `hintsUsed` travels on the attempt rather than being read from
 * the store, which is what keeps graders pure and the authoring guards
 * deterministic.
 */
export function starsFor(
  score: number,
  thresholds: StarThresholds,
  hintsUsed: number,
): Stars {
  const [one, two, three] = thresholds;
  let raw: Stars = 0;
  if (score >= three) raw = 3;
  else if (score >= two) raw = 2;
  else if (score >= one) raw = 1;

  const capped = Math.min(raw, Math.max(0, 3 - Math.max(0, hintsUsed)));
  return capped as Stars;
}

/** The best grade still reachable, so the UI can price a hint before it is taken. */
export function starCap(hintsUsed: number): Stars {
  return Math.max(0, 3 - Math.max(0, hintsUsed)) as Stars;
}

/**
 * Runs every misconception test and returns the matches.
 *
 * Order is the order they were authored. Narrow, high-confidence tests go first
 * and the UI leads with the top match — a predictable rule that an author can
 * reason about, unlike a computed specificity score.
 *
 * A misconception whose test throws is skipped rather than allowed to take down
 * the grade: a broken diagnosis should cost the player an explanation, not their
 * attempt.
 */
export function diagnose<K extends LevelKind>(
  attempt: Attempt[K],
  level: Level<K>,
  data: Series<string>[],
): DiagnosisEntry[] {
  const matched: DiagnosisEntry[] = [];
  for (const misconception of level.misconceptions) {
    try {
      if (misconception.test(attempt, level, data)) {
        matched.push(misconception);
      }
    } catch {
      continue;
    }
  }
  return matched;
}

/**
 * F1 over two sets.
 *
 * Used wherever a level asks for "these things and not others". Recall alone
 * would make marking everything a winning strategy, so precision has to be in
 * the score.
 */
export function f1(hit: number, expected: number, submitted: number): number {
  if (expected === 0 && submitted === 0) return 1;
  if (hit === 0) return 0;
  const precision = hit / submitted;
  const recall = hit / expected;
  return (2 * precision * recall) / (precision + recall);
}
