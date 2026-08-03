import type { Series } from "@/lib/chart/types";
import { riskOf, sizePosition } from "@/lib/instruments/sizing";
import { specFor } from "@/lib/instruments/specs";
import { diagnose, starsFor, type Grade } from "../../grade";
import type { Attempt, Level } from "../../schema";

/**
 * Scoring a position size.
 *
 * The correct answer is **derived, not authored**: one formula over the level's account, risk
 * and stop distance plus the instrument's own contract terms. Authoring the numbers as well
 * would create two sources for one fact and a way for them to disagree — the same reasoning
 * `predict-next` uses for deriving its direction from the data.
 *
 * That also means a level file cannot be read for the answer, and that changing a contract
 * spec cannot leave a level quietly wrong.
 */

/** Full marks inside the tolerance, then a linear decay to zero at three times it. */
const DECAY_MULTIPLE = 2;

export type SizingAnswer = {
  /** What the formula gives for this row. */
  correct: number;
  /** Money at risk once the size is rounded to a tradeable increment. */
  risked: number;
  /** Risk per unit held, which is the number the whole formula turns on. */
  riskPerUnit: number;
};

/**
 * The answer for every row of a level, in order.
 *
 * Exported because three callers need exactly this and a fourth interpretation is how a
 * level would come to disagree with its own grader: the grader, `perfectAttempt`, and the
 * content-claims test that checks 7.3's four rows really do differ.
 */
export function answersFor(level: Level<"sizing-calc">): SizingAnswer[] {
  const { equity, riskPct, positions, answer } = level.config;
  return positions.map((position) => {
    const spec = specFor(position.instrument);
    const result = sizePosition({
      spec,
      equity,
      riskPct,
      entry: position.entry,
      stop: position.stop,
    });

    // A stated size means the question is "what does *this* position risk" — 7.1's question.
    // Without one, `riskCurrency` would answer the risk budget restated.
    if (answer === "riskCurrency" && position.units !== undefined) {
      const risked = riskOf(spec, position.units, position.entry, position.stop);
      return { correct: risked, risked, riskPerUnit: result.riskPerUnit };
    }

    return {
      correct: answer === "units" ? result.units : result.risked,
      risked: result.risked,
      riskPerUnit: result.riskPerUnit,
    };
  });
}

/**
 * Relative error, because the rows are not on one scale.
 *
 * 7.3 asks for 0.0043 BTC on one row and hundreds of shares on the next. A flat tolerance
 * would be meaningless on one and unmissable on the other, so accuracy is judged as a
 * fraction of the right answer.
 *
 * A correct answer of zero is a real answer — gold at 1% of $50,000 is zero contracts,
 * because one contract carries more risk than the whole budget — so it is matched exactly
 * rather than by ratio.
 */
function rowScore(submitted: number | null, correct: number, relative: number): number {
  if (submitted === null || !Number.isFinite(submitted)) return 0;
  if (correct === 0) return submitted === 0 ? 1 : 0;

  const error = Math.abs(submitted - correct) / Math.abs(correct);
  if (error <= relative) return 1;
  const span = Math.max(relative * DECAY_MULTIPLE, 1e-9);
  return Math.max(0, 1 - (error - relative) / span);
}

export function gradeSizingCalc(
  attempt: Attempt["sizing-calc"],
  level: Level<"sizing-calc">,
  data: Series<string>[],
): Grade {
  const answers = answersFor(level);
  const relative = Math.max(level.tolerance.relative, 0);

  const scores = answers.map((answer, i) =>
    rowScore(attempt.values[i] ?? null, answer.correct, relative),
  );
  // The mean, so a level with four rows is four fifths right when one is wrong rather than
  // failed outright. Sizing four instruments correctly and one badly is a partial skill.
  const score = scores.length === 0 ? 0 : scores.reduce((t, s) => t + s, 0) / scores.length;

  const rightRows = scores.filter((s) => s === 1).length;

  return {
    score,
    stars: starsFor(score, level.stars, attempt.hintsUsed),
    diagnosis: diagnose(attempt, level, data),
    reference: {
      kind: "sizing",
      submitted: level.config.positions.map((_p, i) => attempt.values[i] ?? null),
      correct: answers.map((a) => a.correct),
      risked: answers.map((a) => a.risked),
    },
    detail: {
      correct: `${rightRows} of ${answers.length}`,
      "risk budget": Number((level.config.equity * level.config.riskPct).toFixed(2)),
    },
  };
}

export function perfectSizingCalc(
  level: Level<"sizing-calc">,
): Attempt["sizing-calc"] {
  return {
    kind: "sizing-calc",
    values: answersFor(level).map((a) => a.correct),
    hintsUsed: 0,
  };
}
