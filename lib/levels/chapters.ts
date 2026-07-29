import type { LevelId } from "@/lib/store/schema";

/**
 * Chapter metadata only — no level content. Levels arrive as data files in
 * lib/levels/content/ once the level engine exists.
 *
 * `levelCount` excludes the boss, which every chapter has exactly one of.
 * Kept in step with docs/CURRICULUM.md.
 */
export type Chapter = {
  n: number;
  title: string;
  blurb: string;
  levelCount: number;
};

export const CHAPTERS: readonly Chapter[] = [
  {
    n: 1,
    title: "Reading the Chart",
    blurb: "Candles, timeframes, volume, gaps — and a boss that proves you cannot predict yet.",
    levelCount: 7,
  },
  {
    n: 2,
    title: "Market Structure",
    blurb: "Swings, trends, ranges, and the breaks that matter.",
    levelCount: 6,
  },
  {
    n: 3,
    title: "Zones",
    blurb: "Support, resistance, retests, and your first real trade.",
    levelCount: 6,
  },
  {
    n: 4,
    title: "Patterns & Base Rates",
    blurb: "Find the patterns, then see how often they actually work.",
    levelCount: 6,
  },
  {
    n: 5,
    title: "Indicators",
    blurb: "Derived data, lag, and why overbought is not a sell signal.",
    levelCount: 6,
  },
  {
    n: 6,
    title: "Confluence & Multi-Timeframe",
    blurb: "Combining views without talking yourself into a trade.",
    levelCount: 6,
  },
  {
    n: 7,
    title: "Risk, R & Sizing",
    blurb: "One formula, four markets, and a losing streak you have to survive.",
    levelCount: 7,
  },
  {
    n: 8,
    title: "Asset Character",
    blurb: "Measure for yourself why the same setup behaves differently per market.",
    levelCount: 6,
  },
  {
    n: 9,
    title: "Edge & Probability",
    blurb: "Expectancy, sample size, overfitting — and your own trade journal.",
    levelCount: 6,
  },
  {
    n: 10,
    title: "Build Your Own Strategy",
    blurb: "Compose it, backtest it, validate it across markets, export the playbook.",
    levelCount: 7,
  },
];

export function bossId(chapter: number): LevelId {
  return `${chapter}-B`;
}

export function levelIds(chapter: Chapter): LevelId[] {
  const ids: LevelId[] = [];
  for (let i = 1; i <= chapter.levelCount; i += 1) {
    ids.push(`${chapter.n}-${i}`);
  }
  ids.push(bossId(chapter.n));
  return ids;
}

export function getChapter(n: number): Chapter | undefined {
  return CHAPTERS.find((c) => c.n === n);
}
