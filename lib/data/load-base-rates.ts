import type { SeriesId } from "@/lib/chart/types";
import type { PatternStats } from "@/lib/ta/base-rates";
import type { PatternKind } from "@/lib/ta/patterns";

/**
 * Loads the committed pattern base rates on demand.
 *
 * Fetched rather than bundled, like the series and for the same reason: it is a
 * measurement, not code, and only Chapter 4 needs it. `npm run data:rates`
 * regenerates it and `lib/data/base-rates.test.ts` fails if the committed file has
 * drifted from what the shipped detector produces.
 */

export type PatternRates = {
  pooled: PatternStats;
  byAsset: Record<string, PatternStats>;
};

export type BaseRates = {
  /** Exactly what "win rate" means here. Shown to the player beside the table. */
  definition: string;
  horizon: number;
  assets: SeriesId[];
  patterns: Record<PatternKind, PatternRates>;
};

export const BASE_RATES_URL = "/data/base-rates.json";

let cache: BaseRates | null = null;
let inFlight: Promise<BaseRates> | null = null;

function parseStats(value: unknown, where: string): PatternStats {
  if (typeof value !== "object" || value === null) {
    throw new Error(`base-rates: ${where} is not an object`);
  }
  const s = value as Partial<PatternStats>;
  if (typeof s.n !== "number" || typeof s.winRate !== "number") {
    throw new Error(`base-rates: ${where} is missing n or winRate`);
  }
  if (typeof s.meanFwdAtr !== "number") {
    throw new Error(`base-rates: ${where} is missing meanFwdAtr`);
  }
  // A rate without its interval is the thing this whole file exists to prevent, so
  // it is a parse error rather than a rendering fallback.
  if (!Array.isArray(s.ci95) || s.ci95.length !== 2) {
    throw new Error(`base-rates: ${where} is missing a 95% interval`);
  }
  return s as PatternStats;
}

export function parseBaseRates(payload: unknown): BaseRates {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("base-rates: payload is not an object");
  }
  const file = payload as Partial<BaseRates>;
  if (typeof file.definition !== "string" || file.definition.length === 0) {
    throw new Error("base-rates: the definition is missing");
  }
  if (typeof file.horizon !== "number") {
    throw new Error("base-rates: the horizon is missing");
  }
  if (!Array.isArray(file.assets) || file.assets.length === 0) {
    throw new Error("base-rates: the asset list is missing");
  }
  if (typeof file.patterns !== "object" || file.patterns === null) {
    throw new Error("base-rates: no patterns");
  }

  for (const [kind, rates] of Object.entries(file.patterns)) {
    parseStats(rates?.pooled, `${kind}.pooled`);
    for (const asset of file.assets) {
      parseStats(rates?.byAsset?.[asset], `${kind}.byAsset.${asset}`);
    }
  }

  return payload as BaseRates;
}

export async function loadBaseRates(): Promise<BaseRates> {
  if (cache) return cache;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const response = await fetch(BASE_RATES_URL);
    if (!response.ok) {
      throw new Error(`base-rates: HTTP ${response.status} loading ${BASE_RATES_URL}`);
    }
    const rates = parseBaseRates(await response.json());
    cache = rates;
    return rates;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

/** Test-only: module state that would otherwise leak between cases. */
export function resetBaseRatesCacheForTests(): void {
  cache = null;
  inFlight = null;
}
