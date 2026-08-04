import { gzipSync } from "node:zlib";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Fails the build when a route's initial client JavaScript outgrows its budget.
 *
 * The concern this was written for has since been fixed. Every authored level used
 * to be statically imported by the level registry, which is a client module, so all
 * content shipped to every level route — a cost that grew with the curriculum
 * rather than with the page. Level content now loads per level through `import()`.
 *
 * **What this measures, and what it does not.** It sums the scripts the prerendered
 * HTML references, gzipped and deduplicated — the payload a browser fetches before
 * the page is interactive. It does **not** include the level's own content chunk,
 * because a dynamic import is resolved at runtime and appears nowhere in the HTML.
 * That chunk is around 1 KB gzipped, it is fetched only by the route that needs it,
 * and it no longer grows the shared payload. So the number below is the shared cost,
 * which is the one that could quietly run away; the per-level cost is bounded by the
 * size of a single level file.
 */

const BUDGETS: Record<string, number> = {
  "index.html": 200,
  "level/2-3.html": 275,
  "progress.html": 200,
  // The composer, which carries the engine, the block model and the run readout. Watched from M10
  // because it is the only route whose payload can grow with the *strategy vocabulary* rather than
  // with the curriculum, and nothing else would notice.
  "strategy.html": 240,
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
