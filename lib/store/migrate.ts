import { initialPersisted, type Persisted } from "./schema";

/**
 * Fills in anything a stored payload is missing.
 *
 * Runs on every rehydrate, not only on a version bump, because a payload can
 * also be truncated or hand-edited. Merging against `initialPersisted` means a
 * partial payload loads with defaults rather than crashing a selector on
 * `undefined`.
 */
function withDefaults(value: unknown): Persisted {
  if (typeof value !== "object" || value === null) return initialPersisted;
  const stored = value as Partial<Persisted>;
  return {
    profile: {
      ...initialPersisted.profile,
      ...stored.profile,
      settings: {
        ...initialPersisted.profile.settings,
        ...stored.profile?.settings,
      },
    },
    progress: stored.progress ?? {},
    journal: stored.journal ?? [],
    strategies: stored.strategies ?? [],
    predictions: stored.predictions ?? {},
  };
}

/**
 * Version 1 is the first schema, so there is nothing to step through yet. The
 * seam exists now because retrofitting it after players have progress means
 * choosing between stranding them and guessing at their data.
 */
export function migratePersisted(
  persisted: unknown,
  fromVersion: number,
): Persisted {
  void fromVersion;
  return withDefaults(persisted);
}
