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
  /**
   * Whether the player chose the entry, stop and target — or only the size.
   *
   * Optional so saves written before M9 stay valid and `SCHEMA_VERSION` need not move, the
   * same call `attemptNo` made in M5. Undefined is read as planned, because every entry
   * written before M9 came from a `replay-trade` level where the plan was the player's.
   *
   * **9.6's headline figures are computed over planned trades only**, and this is why. Ten of
   * the seventeen entries a full playthrough writes come from 7.B, where the entries, stops and
   * targets were authored and the only decision was size. Pooling them would make "your average
   * loss is 1.4R, not the 1R you set" a claim about the author's stops rather than the
   * player's — the exact error this chapter exists to cure.
   */
  planned?: boolean;
  /** What kind of setup the level called this. See `SetupId`. */
  setup?: string;
};

/**
 * A strategy the player built, as they left it.
 *
 * `blocks` and `lastResult` were `unknown` from M1 until M10, which was the honest placeholder while
 * neither the composer nor the engine existed. They are typed structurally rather than by importing
 * `Block` and `OverlaySpec`, and that is deliberate: `lib/store/` is imported by every route, and a
 * store type reaching into `lib/backtest` and `lib/levels` would drag the block model and the level
 * schema into the graph of pages that have nothing to do with either. The composer casts at its own
 * boundary, where the types are already present.
 *
 * Both stay optional-shaped so saves written before M10 stay valid and `SCHEMA_VERSION` need not
 * move — the same call `attemptNo` made in M5 and `planned` in M9.
 */
export type SavedStrategy = {
  id: string;
  name: string;
  /** The composed entry conditions. `Block[]` from `lib/backtest/blocks`. */
  blocks: unknown;
  /** The last run's overlay, so reopening the page shows what it did rather than a blank. */
  lastResult: unknown;
  /** Which markets it was run over, by series id. */
  scope?: string[];
  /** How many variants the player tried before saving. Chapter 9.5's lesson, kept. */
  variants?: number;
  savedAt?: string;
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
