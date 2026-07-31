import type { Series } from "@/lib/chart/types";
import { diagnose, f1, starsFor, type Grade } from "../../grade";
import type { Attempt, Level } from "../../schema";

/**
 * Scoring a review of somebody else's reasoning.
 *
 * The kind exists for artefacts that are not charts. 1.7, 5.6 and 4.6 were all specified as
 * `spot-the-flaw` and all became `classify`, on the rule that a chart plus a choice is a
 * `classify` — so this stayed unbuilt for four chapters. 6.5 is the case it was held back
 * for: the thing under review is a stack of confirmations justifying a trade, and the
 * question is which of them add nothing.
 *
 * **Scored as set overlap, not as a single choice.** Marking two of three redundant claims
 * while wrongly flagging one sound one is most of the way there, and `f1` — the same
 * measure `mark-bars` uses over bar clicks — says so. A single-answer grader would call it
 * a failure, and the level would be teaching that finding most of a problem is worth
 * nothing.
 */

export function gradeSpotTheFlaw(
  attempt: Attempt["spot-the-flaw"],
  level: Level<"spot-the-flaw">,
  data: Series<string>[],
): Grade {
  const known = new Set(level.config.claims.map((claim) => claim.id));
  // A claim the level does not offer cannot be right or wrong about anything. Not reachable
  // through the component, which only renders what the config declares.
  const flagged = [...new Set(attempt.flagged.filter((id) => known.has(id)))];
  const flawed = level.target.flawed;

  const hit = flagged.filter((id) => flawed.includes(id));
  const score = f1(hit.length, flawed.length, flagged.length);

  return {
    score,
    stars: starsFor(score, level.stars, attempt.hintsUsed),
    diagnosis: diagnose(attempt, level, data),
    reference: { kind: "claims", flagged, flawed, hit },
    detail: {
      found: `${hit.length} of ${flawed.length}`,
      "wrongly flagged": flagged.length - hit.length,
    },
  };
}

export function perfectSpotTheFlaw(
  level: Level<"spot-the-flaw">,
): Attempt["spot-the-flaw"] {
  return {
    kind: "spot-the-flaw",
    flagged: [...level.target.flawed],
    hintsUsed: 0,
  };
}
