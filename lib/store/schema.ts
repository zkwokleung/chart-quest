export const STORAGE_KEY = "chart-quest";

/**
 * Bump when the shape of `Persisted` changes, and add a migration step in
 * `lib/store/migrate.ts`. Players have no accounts, so a shape change without a
 * migration silently discards their only copy of their progress.
 */
export const SCHEMA_VERSION = 1;

export type LevelId = `${number}-${number}` | `${number}-B`;

export type YAxisMode = "price" | "pct" | "atr";

export type Settings = {
  reducedMotion: boolean | "system";
  yAxisMode: YAxisMode;
};

export type LevelProgress = {
  stars: 0 | 1 | 2 | 3;
  bestScore: number;
  attempts: number;
  completedAt: string | null;
};

export type Profile = {
  xp: number;
  streak: number;
  lastPlayed: string | null;
  settings: Settings;
};

export type JournalEntry = {
  id: string;
  levelId: LevelId;
  seriesId: string;
  assetClass: string;
  entry: number;
  stop: number;
  target: number | null;
  exit: number | null;
  r: number | null;
  reason: string;
  tags: string[];
  at: string;
  /**
   * Which attempt at this level the trade was, counting from one.
   *
   * Optional, so saves written before M5 stay valid and `SCHEMA_VERSION` need not
   * move. Every committed trade is logged, retries included — a journal that hides
   * them is not a record — and this is what lets Ch 9.6 tell a considered trade
   * from the fifth try at the same level.
   */
  attemptNo?: number;
};

export type SavedStrategy = {
  id: string;
  name: string;
  blocks: unknown;
  lastResult: unknown;
};

export type Persisted = {
  profile: Profile;
  progress: Partial<Record<LevelId, LevelProgress>>;
  journal: JournalEntry[];
  strategies: SavedStrategy[];
  /** Answers recalled by later levels — e.g. the 1.B coin-flip score read back in 9.2. */
  predictions: Partial<Record<LevelId, unknown>>;
};

export const initialPersisted: Persisted = {
  profile: {
    xp: 0,
    streak: 0,
    lastPlayed: null,
    settings: { reducedMotion: "system", yAxisMode: "price" },
  },
  progress: {},
  journal: [],
  strategies: [],
  predictions: {},
};
