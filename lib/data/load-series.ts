import type { Series, SeriesId } from "@/lib/chart/types";

/**
 * Loads committed price data on demand.
 *
 * Only accepts a `SeriesId`, so out-of-sample data is unreachable from here —
 * Chapter 10 uses `loadOosSeries` instead. See docs/DATA.md.
 */

const cache = new Map<string, Series>();
const inFlight = new Map<string, Promise<Series>>();

export function seriesUrl(id: string): string {
  return `/data/series/${id}.json`;
}

/**
 * Rejects a payload that is not a well-formed series.
 *
 * Levels index straight into these arrays, so a truncated or mismatched file must
 * fail here rather than surface as `undefined` inside a grader.
 */
export function parseSeries(payload: unknown, expectedId: string): Series {
  if (typeof payload !== "object" || payload === null) {
    throw new Error(`${expectedId}: payload is not an object`);
  }
  const s = payload as Partial<Series>;
  if (s.id !== expectedId) {
    throw new Error(`${expectedId}: payload declares id "${String(s.id)}"`);
  }
  if (typeof s.tf !== "string") throw new Error(`${expectedId}: missing timeframe`);

  const columns = ["t", "o", "h", "l", "c", "v"] as const;
  for (const key of columns) {
    if (!Array.isArray(s[key])) throw new Error(`${expectedId}: column ${key} is missing`);
  }
  const length = s.t?.length ?? 0;
  if (length === 0) throw new Error(`${expectedId}: series is empty`);
  for (const key of columns) {
    if (s[key]?.length !== length) {
      throw new Error(
        `${expectedId}: column ${key} has ${s[key]?.length} entries, expected ${length}`,
      );
    }
  }

  return payload as Series;
}

export async function loadSeries(id: SeriesId): Promise<Series> {
  const cached = cache.get(id);
  if (cached) return cached;

  // Two levels mounting at once must not each start their own request.
  const pending = inFlight.get(id);
  if (pending) return pending;

  const request = (async () => {
    const response = await fetch(seriesUrl(id));
    if (!response.ok) {
      throw new Error(`${id}: HTTP ${response.status} loading ${seriesUrl(id)}`);
    }
    const series = parseSeries(await response.json(), id);
    cache.set(id, series);
    return series;
  })();

  inFlight.set(id, request);
  try {
    return await request;
  } finally {
    inFlight.delete(id);
  }
}

/** Test-only: the cache is module state and would otherwise leak between cases. */
export function resetSeriesCacheForTests(): void {
  cache.clear();
  inFlight.clear();
}
