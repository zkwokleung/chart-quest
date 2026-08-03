import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { Series, SeriesId } from "../lib/chart/types.ts";
import {
  computeAssetCharacter,
  SPINE,
  type AssetCharacterFile,
} from "../lib/ta/asset-character.ts";

/**
 * Regenerates `public/data/asset-character.json`.
 *
 * A committed artefact like the base rates: computed once, fetched at runtime rather than
 * bundled, and recomputed by `lib/data/asset-character.test.ts` so a stale file breaks CI
 * instead of quietly teaching last month's numbers.
 *
 *   npm run data:character
 */

const SERIES_DIR = "public/data/series";
const OUT = "public/data/asset-character.json";

function load(id: SeriesId): Series<string> {
  return JSON.parse(
    readFileSync(join(SERIES_DIR, `${id}.json`), "utf8"),
  ) as Series<string>;
}

function report(file: AssetCharacterFile): void {
  const pad = (s: string, n: number) => s.padStart(n);

  console.log(`window ${file.window.from} -> ${file.window.to}`);
  console.log(`${file.alignedDays} days all six markets traded\n`);

  console.log("  market        ATR%    rho1    VR(2)   VR(20)   VR(90)   z(90)");
  for (const id of SPINE) {
    const a = file.byAsset[id]!;
    const vr = (q: number) => a.vr.find((v) => v.q === q)!;
    console.log(
      `  ${id.padEnd(12)} ${pad(a.atrPct.toFixed(2), 5)}  ${pad(a.rho1.toFixed(3), 6)}  ` +
        `${pad(vr(2).vr.toFixed(3), 7)}  ${pad(vr(20).vr.toFixed(3), 7)}  ` +
        `${pad(vr(90).vr.toFixed(3), 7)}  ${pad(vr(90).z.toFixed(1), 6)}` +
        (Math.abs(vr(90).z) >= 2 ? " *" : ""),
    );
  }

  const significant = SPINE.flatMap((id) =>
    file.byAsset[id]!.vr.filter((v) => Math.abs(v.z) >= 2).map((v) => `${id} q${v.q}`),
  );
  console.log(
    `\n  horizons distinguishable from a random walk: ${
      significant.length === 0 ? "none" : significant.join(", ")
    }`,
  );

  console.log("\n  edge            " + SPINE.map((id) => pad(id.split("-")[0]!, 9)).join(""));
  for (const edge of file.edges) {
    const cells = SPINE.map((id) => {
      const r = edge.byAsset[id]!;
      return pad(r.trades === 0 ? "none" : `${r.perTradeR >= 0 ? "+" : ""}${r.perTradeR.toFixed(2)}`, 9);
    });
    console.log(`  ${edge.id.padEnd(14)}` + cells.join(""));
  }

  console.log(`\nwrote ${OUT}`);
}

function main(): void {
  const file = computeAssetCharacter(load);
  writeFileSync(OUT, `${JSON.stringify(file, null, 2)}\n`);
  report(file);
}

/**
 * Only when run as a command.
 *
 * `lib/data/asset-character.test.ts` imports the computation to check the committed file for
 * drift, and a top-level write here would have the test regenerate the file it was about to
 * compare against — a guard that can never fail. `compute-base-rates.ts` learned that the
 * hard way, for one run.
 */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
