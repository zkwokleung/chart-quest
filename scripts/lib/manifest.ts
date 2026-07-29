import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Series } from "../../lib/chart/types.ts";
import type { ManifestEntry, SeriesManifest } from "../../lib/data/manifest-types.ts";

/** Per-file ceiling from docs/DATA.md. */
export const MAX_GZIP_BYTES = 150 * 1024;

export function encodeSeries(series: Series): string {
  return JSON.stringify(series);
}

export type EntryMeta = Pick<
  ManifestEntry,
  "source" | "snapshot" | "reconstructed" | "repairedBars" | "droppedBars" | "note"
>;

export function describe(
  series: Series,
  json: string,
  meta: EntryMeta,
): ManifestEntry {
  const bytes = Buffer.byteLength(json);
  const gzipBytes = gzipSync(Buffer.from(json), { level: 9 }).byteLength;
  const first = series.t[0];
  const last = series.t[series.t.length - 1];
  if (first === undefined || last === undefined) {
    throw new Error(`${series.id}: cannot describe an empty series`);
  }

  return {
    id: series.id,
    tf: series.tf,
    bars: series.t.length,
    firstBar: new Date(first).toISOString(),
    lastBar: new Date(last).toISOString(),
    bytes,
    gzipBytes,
    sha256: createHash("sha256").update(json).digest("hex"),
    ...meta,
  };
}

export async function writeSeriesFile(
  dir: string,
  series: Series,
  json: string,
): Promise<void> {
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${series.id}.json`), json);
}

export async function writeManifest(
  dir: string,
  entries: ManifestEntry[],
): Promise<SeriesManifest> {
  const manifest: SeriesManifest = {
    generatedAt: new Date().toISOString(),
    series: [...entries].sort((a, b) => a.id.localeCompare(b.id)),
  };
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}
