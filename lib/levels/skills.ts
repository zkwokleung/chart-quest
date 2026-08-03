import { disciplineScore } from "@/lib/journal/analytics";
import type { JournalEntry, LevelProgress, Persisted } from "@/lib/store/schema";
import { CHAPTERS, levelIds, type Chapter } from "./chapters";
import { chapterMaxStars, chapterStars } from "./unlock";

/**
 * Ten axes, each declared rather than inferred.
 *
 * ## Why ten when the epic named seven
 *
 * The epic listed structure, zones, patterns, indicators, risk, asset-character and discipline.
 * Mapping those onto chapters leaves **three chapters with no axis**: Chapter 1, reading the chart;
 * Chapter 6, confluence; and Chapter 9, edge and probability. A radar that omits the chapter a
 * beginner spends longest in cannot say "practise this" to a beginner, and one that omits Chapter 9
 * cannot say it to anybody — sample size and expectancy are the chapter the rest of the game is
 * built to earn. So `reading`, `confluence` and `probability` are added.
 *
 * The M9 plan settled on nine of these and missed Chapter 9's own, by the same oversight it was
 * correcting in Chapters 1 and 6. It is recorded here rather than quietly fixed, because the
 * mapping is the kind of thing that looks arbitrary the moment nobody remembers arguing about it.
 *
 * ## Why `discipline` is not a chapter
 *
 * It is the one axis measured from behaviour rather than from answers: whether the player wrote
 * down why, whether their losses stayed inside the risk they set, whether they retried a level
 * until it worked. No chapter teaches it and no grader scores it — which is exactly why the epic
 * listed it, and why it needs the journal. See `disciplineScore`.
 *
 * ## Why Chapter 10 has no axis
 *
 * It is the capstone: it composes, backtests and validates using all nine. A tenth axis would
 * score the same skills twice, and it would read as the weakest one for every player who has not
 * finished the game. The test below asserts the omission is deliberate rather than a gap.
 */
export type SkillAxis =
  | "reading"
  | "structure"
  | "zones"
  | "patterns"
  | "indicators"
  | "confluence"
  | "risk"
  | "asset-character"
  | "probability"
  | "discipline";

export type SkillDefinition = {
  id: SkillAxis;
  label: string;
  /** The chapter this axis is scored from, or null for the one scored from the journal. */
  chapter: number | null;
  /** What a low reading means, so the radar can say more than "you are bad at this". */
  practise: string;
};

export const SKILLS: readonly SkillDefinition[] = [
  {
    id: "reading",
    label: "Reading",
    chapter: 1,
    practise: "What a candle, a timeframe and a gap actually say.",
  },
  {
    id: "structure",
    label: "Structure",
    chapter: 2,
    practise: "Swings, trends, ranges, and which breaks matter.",
  },
  {
    id: "zones",
    label: "Zones",
    chapter: 3,
    practise: "Where price has turned before, and how to trade a retest.",
  },
  {
    id: "patterns",
    label: "Patterns",
    chapter: 4,
    practise: "Finding shapes, and how often each one really resolves.",
  },
  {
    id: "indicators",
    label: "Indicators",
    chapter: 5,
    practise: "Derived data, its lag, and what overbought is not.",
  },
  {
    id: "confluence",
    label: "Confluence",
    chapter: 6,
    practise: "Combining views without talking yourself into a trade.",
  },
  {
    id: "risk",
    label: "Risk",
    chapter: 7,
    practise: "One formula for size, and surviving a losing streak.",
  },
  {
    id: "asset-character",
    label: "Character",
    chapter: 8,
    practise: "Why the same setup behaves differently per market.",
  },
  {
    id: "probability",
    label: "Probability",
    chapter: 9,
    practise: "Expectancy, sample size, and what a tuned backtest is worth.",
  },
  {
    id: "discipline",
    label: "Discipline",
    chapter: null,
    practise: "Stating a reason, holding the risk you set, first-time passes.",
  },
];

export type SkillReading = {
  axis: SkillAxis;
  label: string;
  practise: string;
  /**
   * 0 to 1, or **null for "not attempted"**.
   *
   * The distinction is the whole point of the radar. A chapter scored zero and a chapter never
   * opened both sum to zero stars, and telling a player to practise something they have not
   * reached yet is worse than saying nothing.
   */
  value: number | null;
  /** The reading in its own units, for the label beside the shape. */
  detail: string;
};

function attemptedIn(chapter: Chapter, progress: Persisted["progress"]): boolean {
  const map = progress as Record<string, LevelProgress | undefined>;
  return levelIds(chapter).some((id) => (map[id]?.attempts ?? 0) > 0);
}

export function skillProfile(
  progress: Persisted["progress"],
  journal: readonly JournalEntry[],
): SkillReading[] {
  return SKILLS.map((skill) => {
    if (skill.chapter === null) {
      const value = disciplineScore(journal);
      // The sample size rather than the figure again: the chapter axes carry "14 of 21 stars"
      // beside their percentage, and this is the same house rule — no reading without what it
      // rests on. Planned trades only, because the authored ones were not the player's decisions.
      const planned = journal.filter((e) => e.planned !== false).length;
      return {
        axis: skill.id,
        label: skill.label,
        practise: skill.practise,
        value,
        detail:
          value === null
            ? "no trades yet"
            : `from ${planned} trade${planned === 1 ? "" : "s"}`,
      };
    }

    const chapter = CHAPTERS.find((c) => c.n === skill.chapter);
    if (!chapter) {
      return {
        axis: skill.id,
        label: skill.label,
        practise: skill.practise,
        value: null,
        detail: "not authored",
      };
    }

    const stars = chapterStars(chapter, progress);
    const max = chapterMaxStars(chapter);
    if (!attemptedIn(chapter, progress)) {
      return {
        axis: skill.id,
        label: skill.label,
        practise: skill.practise,
        value: null,
        detail: "not started",
      };
    }
    return {
      axis: skill.id,
      label: skill.label,
      practise: skill.practise,
      value: max === 0 ? null : stars / max,
      detail: `${stars} of ${max} stars`,
    };
  });
}

/** The axes worth practising: attempted, and below the threshold. Weakest first. */
export function weakestSkills(
  readings: readonly SkillReading[],
  below = 0.67,
): SkillReading[] {
  return readings
    .filter((r) => r.value !== null && r.value < below)
    .sort((a, b) => (a.value ?? 0) - (b.value ?? 0));
}
