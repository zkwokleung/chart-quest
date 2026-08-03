import type { EdgeSweepFile } from "@/lib/ta/edge-sweep";

/**
 * Loads the committed parameter sweep on demand.
 *
 * Fetched rather than bundled, like the series, the base rates and the asset-character table:
 * it is a measurement rather than code, only Chapter 9 needs it, and `behaviour.ts` — imported
 * eagerly by every level route — must not grow a dependency on the estimator that produced it.
 * `npm run data:sweep` regenerates it and `lib/data/edge-sweep.test.ts` fails on drift.
 */

export const EDGE_SWEEP_URL = "/data/edge-sweep.json";

let cache: EdgeSweepFile | null = null;
let inFlight: Promise<EdgeSweepFile> | null = null;

function need(condition: boolean, message: string): void {
  if (!condition) throw new Error(`edge-sweep: ${message}`);
}

function parse(value: unknown): EdgeSweepFile {
  need(typeof value === "object" && value !== null, "file is not an object");
  const file = value as Partial<EdgeSweepFile>;

  need(typeof file.definition === "string", "has no definition");
  need(Array.isArray(file.lookbacks) && file.lookbacks.length > 1, "has no lookbacks");
  need(typeof file.inSampleFraction === "number", "does not state its split");
  need(Array.isArray(file.assets) && file.assets.length > 0, "has no assets");

  for (const asset of file.assets!) {
    need(typeof asset.splitDate === "string", `${asset.asset} has no split date`);
    need(
      asset.cells.length === file.lookbacks!.length,
      `${asset.asset} has ${asset.cells.length} cells for ${file.lookbacks!.length} lookbacks`,
    );
    for (const cell of asset.cells) {
      // **A total R with no trade count is a number nobody can argue with**, and Chapter 9 is
      // the chapter about not accepting those. So it is a parse error rather than a blank cell.
      need(
        typeof cell.inSample.trades === "number" && typeof cell.later.trades === "number",
        `${asset.asset} n=${cell.n} reports a total without its sample size`,
      );
      need(
        typeof cell.rankLater === "number",
        `${asset.asset} n=${cell.n} has no later-window rank`,
      );
    }
  }

  return file as EdgeSweepFile;
}

export async function loadEdgeSweep(): Promise<EdgeSweepFile> {
  if (cache) return cache;
  inFlight ??= fetch(EDGE_SWEEP_URL)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`edge-sweep: ${response.status} fetching the sweep`);
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

/** Test seam, mirroring the other loaders. */
export function __resetEdgeSweepCache(): void {
  cache = null;
  inFlight = null;
}
