import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const CACHE_DIR = ".data-cache";

/**
 * Yahoo rejects requests without a browser-ish User-Agent.
 */
const HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; chart-quest data build)" };

const RETRY_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 4;

/** Yahoo is the sole source for six of ten series, so requests stay sequential and spaced. */
const POLITE_DELAY_MS = 350;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cachePath(url: string): string {
  const hash = createHash("sha256").update(url).digest("hex").slice(0, 24);
  return join(CACHE_DIR, `${hash}.json`);
}

/**
 * Fetches JSON, caching the raw response on disk.
 *
 * The cache is not an optimisation — it keeps repeated development runs from
 * hammering upstream, which is the fastest way to get rate-limited off a free
 * source. `.data-cache/` is gitignored; only the normalized output is committed.
 */
export async function getJson<T>(
  url: string,
  { cache = true }: { cache?: boolean } = {},
): Promise<T> {
  const path = cachePath(url);

  if (cache) {
    try {
      return JSON.parse(await readFile(path, "utf8")) as T;
    } catch {
      // Not cached yet.
    }
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, { headers: HEADERS });
      if (!response.ok) {
        if (RETRY_STATUS.has(response.status) && attempt < MAX_ATTEMPTS) {
          const backoff = POLITE_DELAY_MS * 4 ** attempt;
          console.warn(`  ${response.status} on attempt ${attempt}, retrying in ${backoff}ms`);
          await sleep(backoff);
          continue;
        }
        throw new Error(`HTTP ${response.status} ${response.statusText} for ${url}`);
      }
      const text = await response.text();
      if (cache) {
        await mkdir(CACHE_DIR, { recursive: true });
        await writeFile(path, text);
      }
      await sleep(POLITE_DELAY_MS);
      return JSON.parse(text) as T;
    } catch (err) {
      lastError = err;
      if (attempt === MAX_ATTEMPTS) break;
      await sleep(POLITE_DELAY_MS * 4 ** attempt);
    }
  }

  throw new Error(`failed after ${MAX_ATTEMPTS} attempts: ${url}`, { cause: lastError });
}
