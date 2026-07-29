import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { migratePersisted } from "./migrate";
import { safeStorage } from "./safe-storage";
import {
  initialPersisted,
  SCHEMA_VERSION,
  STORAGE_KEY,
  type LevelId,
  type LevelProgress,
  type Persisted,
  type Settings,
} from "./schema";

type Actions = {
  recordAttempt(levelId: LevelId, score: number, stars: 0 | 1 | 2 | 3): void;
  recordPrediction(levelId: LevelId, answer: unknown): void;
  updateSettings(patch: Partial<Settings>): void;
  resetProgress(): void;
};

export type GameState = Persisted & Actions;

const STARS_TO_XP: Record<0 | 1 | 2 | 3, number> = { 0: 0, 1: 40, 2: 80, 3: 140 };

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

      updateSettings(patch) {
        set((state) => ({
          profile: {
            ...state.profile,
            settings: { ...state.profile.settings, ...patch },
          },
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
      partialize: ({ profile, progress, journal, strategies, predictions }) => ({
        profile,
        progress,
        journal,
        strategies,
        predictions,
      }),
    },
  ),
);
