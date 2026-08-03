import type { AssetCharacterFile } from "@/lib/ta/asset-character";

/**
 * Loads the committed asset-character measurements on demand.
 *
 * Fetched rather than bundled, like the series and the base rates, and for the same reasons:
 * it is a measurement rather than code, only Chapter 8 needs it, and `behaviour.ts` — which
 * every level route imports eagerly — must not grow a dependency on the estimators that
 * produced it. `npm run data:character` regenerates it and `lib/data/asset-character.test.ts`
 * fails if the committed file has drifted from what the shipped code computes.
 */

export const ASSET_CHARACTER_URL = "/data/asset-character.json";

let cache: AssetCharacterFile | null = null;
let inFlight: Promise<AssetCharacterFile> | null = null;

function need(condition: boolean, message: string): void {
  if (!condition) throw new Error(`asset-character: ${message}`);
}

function parseMatrix(value: unknown, where: string): void {
  need(typeof value === "object" && value !== null, `${where} is not an object`);
  const m = value as { assets?: unknown; rows?: unknown; n?: unknown };
  need(Array.isArray(m.assets), `${where} has no assets`);
  need(Array.isArray(m.rows), `${where} has no rows`);
  // A correlation without its sample size is a number nobody can argue with, and 8.4's whole
  // point is which numbers deserve trust. Missing `n` is a parse error rather than a blank cell.
  need(typeof m.n === "number", `${where} does not report its sample size`);
}

function parse(value: unknown): AssetCharacterFile {
  need(typeof value === "object" && value !== null, "file is not an object");
  const file = value as Partial<AssetCharacterFile>;

  need(typeof file.definition === "string", "has no definition");
  need(Array.isArray(file.assets) && file.assets.length > 0, "has no assets");
  need(Array.isArray(file.horizons) && file.horizons.length > 0, "has no horizons");
  need(typeof file.alignedDays === "number", "does not report its aligned day count");
  need(typeof file.byAsset === "object" && file.byAsset !== null, "has no byAsset");

  for (const id of file.assets!) {
    const facts = file.byAsset![id];
    need(facts !== undefined, `byAsset is missing ${id}`);
    need(Array.isArray(facts!.vr), `${id} has no variance ratios`);
    need(
      facts!.vr.length === file.horizons!.length,
      `${id} has ${facts!.vr.length} ratios for ${file.horizons!.length} horizons`,
    );
    // The z is what stops a level overclaiming, so a file without one does not load.
    for (const point of facts!.vr) {
      need(typeof point.z === "number", `${id} q${point.q} has no z`);
    }
  }

  need(file.correlation !== undefined, "has no correlation block");
  parseMatrix(file.correlation!.allDays, "correlation.allDays");
  parseMatrix(file.correlation!.indexWorstDecile, "correlation.indexWorstDecile");
  parseMatrix(file.correlation!.calmDays, "correlation.calmDays");

  need(Array.isArray(file.edges) && file.edges.length > 0, "has no edges");

  return file as AssetCharacterFile;
}

export async function loadAssetCharacter(): Promise<AssetCharacterFile> {
  if (cache) return cache;
  inFlight ??= fetch(ASSET_CHARACTER_URL)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`asset-character: ${response.status} fetching the measurements`);
      }
      const parsed = parse(await response.json());
      cache = parsed;
      return parsed;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/** Test seam, mirroring `load-base-rates.ts`. */
export function __resetAssetCharacterCache(): void {
  cache = null;
  inFlight = null;
}
