import { migratePersisted } from "./migrate";
import {
  SCHEMA_VERSION,
  type JournalEntry,
  type LevelProgress,
  type Persisted,
  type SavedStrategy,
} from "./schema";

/**
 * Moving a save between browsers, which is the only way there is.
 *
 * There are no accounts, so a player's progress exists in exactly one `localStorage` key on exactly
 * one device. Clearing site data destroys ten chapters with no recovery, and so does switching
 * machines. `docs/PLAN.md` has called this "not a nicety" since M1 and it is the last thing missing.
 *
 * ## Why `importSave` does not use `migratePersisted`
 *
 * **The mistake this module exists to avoid making.** `migratePersisted` calls `withDefaults`, which
 * merges whatever it is handed against `initialPersisted`. That is exactly right for rehydrating our
 * own storage: a payload truncated by a quota error should load with defaults rather than crash a
 * selector on `undefined`.
 *
 * It is exactly wrong for a file. Handed a text file, a screenshot's metadata or another app's JSON,
 * `withDefaults` returns a valid-looking `Persisted` with empty progress — so importing a garbage file
 * would *succeed*, replacing ten chapters with a fresh save. The feature meant to protect a player's
 * only copy would be the thing that deleted it.
 *
 * So the order is **validate, then migrate**. Nothing reaches `migratePersisted` until its shape has
 * been checked, and a failure returns a reason rather than a default. `withDefaults` still does its
 * job afterwards — filling fields a genuinely older save predates — which is the one thing it is for.
 *
 * ## Why the file carries an `app` field
 *
 * So that importing the wrong file says "this is not a Chart Quest save" instead of silently wiping
 * progress. Every rejection here names what was wrong, because the alternative — a blank save and no
 * explanation — is indistinguishable from the bug this module prevents.
 */

export type SaveFile = {
  app: "chart-quest";
  schema: number;
  exportedAt: string;
  state: Persisted;
};

const APP = "chart-quest";

/**
 * Pretty-printed on purpose.
 *
 * The file is the player's backup and their only view of what the game holds about them. Minifying it
 * would save a few kilobytes of a file nobody transmits, and cost the ability to read it.
 */
export function exportSave(state: Persisted, exportedAt: string): string {
  const file: SaveFile = { app: APP, schema: SCHEMA_VERSION, exportedAt, state };
  return `${JSON.stringify(file, null, 2)}\n`;
}

export type ImportResult =
  | { ok: true; state: Persisted }
  | { ok: false; error: string };

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A finite number, which `typeof` alone does not give — NaN and Infinity both pass that. */
const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isNumberOrNull = (value: unknown): boolean => value === null || isNumber(value);

function validProgressEntry(value: unknown): value is LevelProgress {
  if (!isObject(value)) return false;
  return (
    isNumber(value.stars) &&
    value.stars >= 0 &&
    value.stars <= 3 &&
    isNumber(value.bestScore) &&
    isNumber(value.attempts) &&
    (value.completedAt === null || typeof value.completedAt === "string")
  );
}

/**
 * A journal entry, checked on the fields anything downstream reads.
 *
 * `r` may be null — a trade can be logged before it resolved — but it may not be a string, because
 * `statsFor` maps it straight into arithmetic and a string would propagate as `NaN` through an
 * expectancy the player would then be shown.
 */
function validJournalEntry(value: unknown): value is JournalEntry {
  if (!isObject(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.levelId === "string" &&
    typeof value.seriesId === "string" &&
    typeof value.assetClass === "string" &&
    isNumber(value.entry) &&
    isNumber(value.stop) &&
    isNumberOrNull(value.target) &&
    isNumberOrNull(value.exit) &&
    isNumberOrNull(value.r) &&
    typeof value.reason === "string" &&
    Array.isArray(value.tags) &&
    typeof value.at === "string"
  );
}

function validStrategy(value: unknown): value is SavedStrategy {
  if (!isObject(value)) return false;
  // `blocks` and `lastResult` are deliberately `unknown` in the schema — the store must not depend on
  // `lib/backtest` — so there is nothing here to check beyond their presence and the identity fields.
  return typeof value.id === "string" && typeof value.name === "string";
}

/**
 * Reads a save file, or says why it could not.
 *
 * Never partially applied: either the whole payload is sound and the caller gets a `Persisted`, or
 * nothing changes. A half-imported save is worse than a refused one, because the player cannot tell.
 */
export function importSave(text: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {
      ok: false,
      error: "That file is not valid JSON. A Chart Quest save is the .json file the game downloads.",
    };
  }

  if (!isObject(parsed)) {
    return { ok: false, error: "That file does not contain a save." };
  }

  if (parsed.app !== APP) {
    return {
      ok: false,
      error:
        typeof parsed.app === "string"
          ? `That save is from "${parsed.app}", not Chart Quest.`
          : "That file is not a Chart Quest save — it is missing the marker the game writes.",
    };
  }

  if (!isNumber(parsed.schema)) {
    return { ok: false, error: "That save does not say which version it is, so it cannot be read." };
  }

  if (parsed.schema > SCHEMA_VERSION) {
    return {
      ok: false,
      error: `That save was written by a newer version of the game (format ${parsed.schema}; this one reads up to ${SCHEMA_VERSION}). Update the page and try again.`,
    };
  }

  const state = parsed.state;
  if (!isObject(state)) {
    return { ok: false, error: "That save has no progress in it." };
  }

  // Each of the four collections is checked rather than trusted, because each one is read by code
  // that assumes its shape: a `progress` array would make `Object.entries` produce indices as level
  // ids, and the chapter map would show every chapter locked.
  if (!isObject(state.progress)) {
    return { ok: false, error: "That save's level progress is the wrong shape." };
  }
  for (const [id, entry] of Object.entries(state.progress)) {
    if (!validProgressEntry(entry)) {
      return { ok: false, error: `That save's entry for level ${id} is not readable.` };
    }
  }

  if (!Array.isArray(state.journal)) {
    return { ok: false, error: "That save's trade journal is the wrong shape." };
  }
  const badTrade = state.journal.findIndex((entry) => !validJournalEntry(entry));
  if (badTrade !== -1) {
    return { ok: false, error: `That save's trade number ${badTrade + 1} is not readable.` };
  }

  if (!Array.isArray(state.strategies)) {
    return { ok: false, error: "That save's strategies are the wrong shape." };
  }
  const badStrategy = state.strategies.findIndex((entry) => !validStrategy(entry));
  if (badStrategy !== -1) {
    return { ok: false, error: `That save's strategy number ${badStrategy + 1} is not readable.` };
  }

  if (state.predictions !== undefined && !isObject(state.predictions)) {
    return { ok: false, error: "That save's recalled answers are the wrong shape." };
  }

  // Only now. `migratePersisted` fills in what an older save predates — the one thing its leniency is
  // for — and by this point there is nothing left for it to paper over.
  return { ok: true, state: migratePersisted(state, parsed.schema) };
}

/** What a file holds, for the confirmation that has to precede replacing ten chapters. */
export type SaveSummary = {
  exportedAt: string | null;
  levelsPlayed: number;
  chaptersCleared: number;
  totalStars: number;
  trades: number;
  strategies: number;
};

export function summarise(state: Persisted, exportedAt: string | null): SaveSummary {
  const entries = Object.entries(state.progress) as [string, LevelProgress][];
  const bosses = entries.filter(
    ([id, entry]) => id.endsWith("-B") && entry.stars >= 2,
  );
  return {
    exportedAt,
    levelsPlayed: entries.filter(([, entry]) => entry.attempts > 0).length,
    chaptersCleared: bosses.length,
    totalStars: entries.reduce((total, [, entry]) => total + entry.stars, 0),
    trades: state.journal.length,
    strategies: state.strategies.length,
  };
}

/** The `exportedAt` of a file that has already parsed, for the summary. Null when absent. */
export function exportedAtOf(text: string): string | null {
  try {
    const parsed: unknown = JSON.parse(text);
    if (isObject(parsed) && typeof parsed.exportedAt === "string") return parsed.exportedAt;
  } catch {
    /* the caller has already reported the parse failure */
  }
  return null;
}
