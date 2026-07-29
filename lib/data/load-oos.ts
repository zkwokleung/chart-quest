import type { OosSeriesId, Series } from "@/lib/chart/types";
import { parseSeries } from "./load-series";

/**
 * Loads out-of-sample data. Chapter 10 only.
 *
 * Deliberately a separate module from `load-series.ts` with a separate id type and
 * a separate manifest. Chapter 10.6 asks whether a strategy survives on data the
 * player has never seen — if any earlier chapter could reach these bars, that
 * question would be theatre.
 *
 * Nothing outside Chapter 10 should import this. `docs/DATA.md` records the rule;
 * the level-content guard that enforces it arrives with the authoring guards.
 */

const cache = new Map<string, Series<OosSeriesId>>();

export function oosSeriesUrl(id: OosSeriesId): string {
  return `/data/oos/${id}.json`;
}

export async function loadOosSeries(id: OosSeriesId): Promise<Series<OosSeriesId>> {
  const cached = cache.get(id);
  if (cached) return cached;

  const response = await fetch(oosSeriesUrl(id));
  if (!response.ok) {
    throw new Error(`${id}: HTTP ${response.status} loading ${oosSeriesUrl(id)}`);
  }
  const series = parseSeries(await response.json(), id) as unknown as Series<OosSeriesId>;
  cache.set(id, series);
  return series;
}

/** Test-only: the cache is module state and would otherwise leak between cases. */
export function resetOosCacheForTests(): void {
  cache.clear();
}
