import { gzipSync } from "node:zlib";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Fails the build when a route's client JavaScript outgrows its budget.
 *
 * The concern this exists for is specific: every authored level is imported by
 * the level registry, and the registry is a client module, so *all* level
 * content ships to *every* level route. That cost grows with the curriculum
 * rather than with the page, and at ~73 levels it is the one number that can get
 * away from us quietly. A budget in CI turns "keep an eye on it" into a number
 * that has to be argued with.
 *
 * Measures what a browser actually downloads for a route: the scripts the
 * prerendered HTML references, gzipped, deduplicated. Not `.next/static` in
 * total, which counts chunks no single route loads.
 */

const BUDGETS: Record<string, number> = {
  "index.html": 200,
  "level/2-3.html": 275,
  "progress.html": 200,
};

const NEXT = ".next";

function scriptsIn(html: string): string[] {
  const found = new Set<string>();
  // Both the plain attribute form and the escaped form Next embeds in its
  // streaming payload, or preloaded chunks would be missed.
  for (const m of html.matchAll(
    /(?:src|href)="(\/_next\/static\/[^"]+\.js)"/g,
  )) {
    if (m[1]) found.add(m[1]);
  }
  for (const m of html.matchAll(/\\"(\/_next\/static\/[^"\\]+\.js)\\"/g)) {
    if (m[1]) found.add(m[1]);
  }
  return [...found];
}

function gzippedKb(paths: string[]): { kb: number; missing: string[] } {
  let bytes = 0;
  const missing: string[] = [];
  for (const p of paths) {
    const file = join(NEXT, p.replace(/^\/_next\//, ""));
    if (!existsSync(file)) {
      missing.push(p);
      continue;
    }
    bytes += gzipSync(readFileSync(file)).length;
  }
  return { kb: bytes / 1024, missing };
}

let failed = false;

for (const [route, budgetKb] of Object.entries(BUDGETS)) {
  const htmlPath = join(NEXT, "server/app", route);
  if (!existsSync(htmlPath)) {
    console.error(`✗ ${route}: not built — run \`npm run build\` first`);
    failed = true;
    continue;
  }

  const refs = scriptsIn(readFileSync(htmlPath, "utf8"));
  const { kb, missing } = gzippedKb(refs);

  // A route whose chunks cannot be resolved would otherwise measure as 0 KB and
  // pass the budget while telling us nothing.
  if (refs.length === 0 || missing.length > 0) {
    console.error(
      `✗ ${route}: ${refs.length} scripts referenced, ${missing.length} unresolved — ` +
        `the measurement is wrong, not the bundle`,
    );
    failed = true;
    continue;
  }

  const pct = Math.round((kb / budgetKb) * 100);
  const line = `${route}: ${kb.toFixed(1)} KB gz of ${budgetKb} KB budget (${pct}%, ${refs.length} chunks)`;

  if (kb > budgetKb) {
    console.error(`✗ ${line}`);
    failed = true;
  } else {
    console.log(`✓ ${line}`);
  }
}

if (failed) {
  console.error(
    "\nA budget is a decision, not a limit handed down. If the growth is worth it," +
      "\nraise the number in scripts/check-bundle.ts and say why in the commit.",
  );
  process.exit(1);
}
