import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { migratePersisted } from "./migrate";
import { safeStorage } from "./safe-storage";
import {
  initialPersisted,
  SCHEMA_VERSION,
  STORAGE_KEY,
  type LevelId,
  type JournalEntry,
  type LevelProgress,
  type Persisted,
  type SavedStrategy,
  type Settings,
} from "./schema";

type Actions = {
  recordAttempt(levelId: LevelId, score: number, stars: 0 | 1 | 2 | 3): void;
  recordPrediction(levelId: LevelId, answer: unknown): void;
  /**
   * Logs one attempt's trades. Plural because an attempt can produce several.
   *
   * A composite boss produces one entry per replay stage and 7.B produces ten, so the singular
   * version dropped five sixths of the record. All the entries in one call share an
   * `attemptNo`, because they are one attempt.
   */
  logTrades(entries: Omit<JournalEntry, "id" | "at" | "attemptNo">[]): void;
  /**
   * Saves a strategy under a name, replacing one already saved under it.
   *
   * By name rather than appending, because the composer is a workbench: a player refining one rule
   * would otherwise accumulate forty near-identical entries and Chapter 10.B would export the wrong
   * one. Renaming is how you keep two.
   */
  saveStrategy(strategy: Omit<SavedStrategy, "id" | "savedAt">): void;
  forgetStrategy(name: string): void;
  updateSettings(patch: Partial<Settings>): void;
  resetProgress(): void;
};

/**
 * Trades kept in the journal.
 *
 * localStorage is finite and the M1 quota bug surfaced as progress vanishing
 * between screens, so this is capped rather than left to grow. Oldest go first:
 * Chapter 9 analyses patterns across many trades, and the most recent are the ones
 * a player is still learning from.
 */
const JOURNAL_LIMIT = 500;

/**
 * Trims the journal to `JOURNAL_LIMIT`, dropping whole attempts rather than entries.
 *
 * Per-entry eviction became a correctness bug the moment writes batched: it can leave five of
 * 7.B's ten trades in the record, which Chapter 9.6 then reads as a five-trade run at a level
 * that has ten — a wrong number rather than a missing one, and the kind a player cannot detect.
 *
 * Attempts are dropped oldest-first by their earliest entry. An attempt larger than the whole
 * limit would loop forever, so the last group is always kept: a truncated record is still
 * better than none, and the alternative is a hang.
 */
function evictWholeAttempts(journal: JournalEntry[]): JournalEntry[] {
  if (journal.length <= JOURNAL_LIMIT) return journal;

  const groups = new Map<string, JournalEntry[]>();
  for (const entry of journal) {
    const key = `${entry.levelId}#${entry.attemptNo ?? "legacy"}`;
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }

  const ordered = [...groups.values()].sort(
    (a, b) => (a[0]?.at ?? "").localeCompare(b[0]?.at ?? ""),
  );

  let total = journal.length;
  let dropped = 0;
  while (total > JOURNAL_LIMIT && dropped < ordered.length - 1) {
    total -= ordered[dropped]!.length;
    dropped += 1;
  }
  return ordered.slice(dropped).flat();
}

export type GameState = Persisted & Actions;

const STARS_TO_XP: Record<0 | 1 | 2 | 3, number> = {
  0: 0,
  1: 40,
  2: 80,
  3: 140,
};

export const useGameStore = create<GameState>()(
  persist(
    (set) => ({
      ...initialPersisted,

      recordAttempt(levelId, score, stars) {
        set((state) => {
          const previous: LevelProgress = state.progress[levelId] ?? {
            stars: 0,
            bestScore: 0,
            attempts: 0,
            completedAt: null,
          };
          const improved = stars > previous.stars;
          return {
            progress: {
              ...state.progress,
              [levelId]: {
                stars: improved ? stars : previous.stars,
                bestScore: Math.max(previous.bestScore, score),
                attempts: previous.attempts + 1,
                completedAt:
                  previous.completedAt ??
                  (stars > 0 ? new Date().toISOString() : null),
              },
            },
            // Only the improvement is paid out, so replaying a solved level to
            // farm XP does nothing.
            profile: {
              ...state.profile,
              xp:
                state.profile.xp +
                (improved
                  ? STARS_TO_XP[stars] - STARS_TO_XP[previous.stars]
                  : 0),
              lastPlayed: new Date().toISOString(),
            },
          };
        });
      },

      recordPrediction(levelId, answer) {
        set((state) => ({
          predictions: { ...state.predictions, [levelId]: answer },
        }));
      },

      logTrades(entries) {
        if (entries.length === 0) return;
        set((state) => {
          // Every committed trade is logged, retries included. A journal that hides your
          // retries is not a journal, and Chapter 9.6's credibility rests on it being the real
          // record — `attemptNo` is what lets 9.6 separate a considered trade from the fifth
          // attempt at a level.
          const levelId = entries[0]!.levelId;
          const mine = state.journal.filter((t) => t.levelId === levelId);

          // **One attempt number for the whole batch.** Counting entries would number 7.B's
          // ten trades 1…10 within a single attempt, and 9.6 reads `attemptNo` to tell a
          // considered trade from a retry. Falls back to counting for entries written before
          // M5, which carry no `attemptNo` and were count-derived at the time.
          const seen = mine.reduce(
            (highest, t) => Math.max(highest, t.attemptNo ?? 0),
            0,
          );
          const attemptNo = Math.max(seen, mine.filter((t) => t.attemptNo === undefined).length) + 1;

          const at = new Date().toISOString();
          const logged: JournalEntry[] = entries.map((entry, i) => ({
            ...entry,
            // The index matters: ten entries in one batch share an ISO millisecond.
            id: `${entry.levelId}-${attemptNo}-${i}-${at}`,
            at,
            attemptNo,
          }));

          return { journal: evictWholeAttempts([...state.journal, ...logged]) };
        });
      },

      updateSettings(patch) {
        set((state) => ({
          profile: {
            ...state.profile,
            settings: { ...state.profile.settings, ...patch },
          },
        }));
      },

      saveStrategy(strategy) {
        set((state) => {
          const kept = state.strategies.filter((s) => s.name !== strategy.name);
          const existing = state.strategies.find((s) => s.name === strategy.name);
          return {
            strategies: [
              ...kept,
              {
                // Reused so a rename is a rename and a save is not a new strategy every time.
                id: existing?.id ?? `${strategy.name}-${new Date().toISOString()}`,
                savedAt: new Date().toISOString(),
                ...strategy,
              },
            ],
          };
        });
      },

      forgetStrategy(name) {
        set((state) => ({
          strategies: state.strategies.filter((s) => s.name !== name),
        }));
      },

      resetProgress() {
        set({ ...initialPersisted });
      },
    }),
    {
      name: STORAGE_KEY,
      version: SCHEMA_VERSION,
      storage: createJSONStorage(() => safeStorage),
      migrate: migratePersisted,
      // Rehydrating during render mismatches the server-rendered HTML. Consumers
      // wait on `useHydrated()` instead of reading progress on first paint.
      skipHydration: true,
      partialize: ({
        profile,
        progress,
        journal,
        strategies,
        predictions,
      }) => ({
        profile,
        progress,
        journal,
        strategies,
        predictions,
      }),
    },
  ),
);
