import { expect, test, type Page } from "@playwright/test";
import { getAuthoredLevel } from "@/lib/levels/content/all";

/**
 * The launch pass: a whole chapter played, a reload survived, and a cache cleared.
 *
 * The chapter specs each prove their own content works. What none of them covers is the shape of a
 * *session* — progress accumulating across levels, surviving a reload, and what happens when the one
 * place it lives goes away. That last one is not hypothetical: the M1 quota bug surfaced as progress
 * vanishing between screens, and `safe-storage.ts` exists because of it.
 *
 * Chapter 1 is played rather than seeded, level by level, which is the only test in the suite that
 * exercises the unlock chain the way a person meets it.
 */

const KEY = "chart-quest";

async function stored(page: Page) {
  return page.evaluate(
    (key) => JSON.parse(window.localStorage.getItem(key) ?? "{}"),
    KEY,
  );
}

const starsFor = async (page: Page, id: string) =>
  ((await stored(page)) as { state?: { progress?: Record<string, { stars?: number }> } }).state
    ?.progress?.[id]?.stars;

/**
 * Chapter 1, level by level, answering each one correctly.
 *
 * **Correct answers are not decoration here.** `isLevelUnlocked` requires the previous level to have
 * scored above zero, so a run that guesses stalls at the first wrong answer — which is the unlock chain
 * working, and the reason this helper reads each level's own `target` instead of clicking the first
 * option. Importing the content is free: Playwright specs run in node, the same place the unit suite
 * reads them from.
 */
async function playChapterOne(page: Page) {
  // 1.1 is `mark-bars` in `candle-anatomy` mode: its answer is a candle *part*, and each part is a real
  // button. Read from the target so the test cannot drift from the level.
  const anatomy = getAuthoredLevel("1-1");
  if (!anatomy || anatomy.kind !== "mark-bars") throw new Error("1-1 is no longer mark-bars");
  const part = anatomy.target.marks[0]?.replace("part:", "");
  if (!part) throw new Error("1-1 names no part to mark");

  await page.goto("/level/1-1");
  await page.getByRole("button", { name: new RegExp(`^${part}$`, "i") }).click();
  await page.getByRole("button", { name: /commit answer/i }).click();
  await expect.poll(async () => starsFor(page, "1-1")).toBeGreaterThan(0);

  for (const id of ["1-2", "1-3", "1-5", "1-6", "1-7"]) {
    const level = getAuthoredLevel(id);
    if (!level || level.kind !== "classify") throw new Error(`${id} is not a classify level`);

    await page.goto(`/level/${id}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    for (const correct of level.target.correct) {
      const option = level.config.options.find((o) => o.id === correct);
      if (!option) throw new Error(`${id} names a correct option that does not exist: ${correct}`);
      await page.getByRole("radio", { name: option.label, exact: true }).check();
    }
    await page.getByRole("button", { name: /commit answer/i }).click();
    await expect.poll(async () => starsFor(page, id)).toBeGreaterThan(0);
  }

  // 1.4 is the chapter's only `mark-bars`, and its bars live on a canvas — so it is played from the
  // keyboard surface, navigating by the cursor the component announces. The three targets are
  // consecutive (2677-2679) and the cursor starts at the slice's first bar.
  await page.goto("/level/1-4");
  const surface = page.getByRole("application");
  await surface.focus();
  const cursor = page.getByText(/^cursor: bar \d+/);
  await expect(cursor).toBeVisible();

  for (let i = 0; i < 6; i += 1) await page.keyboard.press("Shift+ArrowRight");
  for (let i = 0; i < 7; i += 1) await page.keyboard.press("ArrowRight");
  // Asserted rather than counted on faith: if the step size ever changes, this says so.
  await expect(cursor).toContainText("bar 2677");

  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: /commit/i }).click();
  await expect.poll(async () => starsFor(page, "1-4")).toBeGreaterThan(0);

  // The boss is `predict-next`, which scores participation rather than accuracy — 1.B exists to show
  // the player they cannot predict yet, so calling every round is what clears it. Each round is
  // call → reveal → "Next round", and the commit only appears once every round has an answer.
  await page.goto("/level/1-B");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // **Wait for the controls before counting them.** `count()` does not auto-wait, so using it as a
  // loop guard races the Suspense boundary the kind component loads behind: the heading renders from
  // the level shell first, so a `count()` taken immediately is 0 and the loop exits having answered
  // nothing. `expect(...).toBeVisible()` waits; `click()` waits; `count()` is the one that does not.
  await expect(page.getByRole("button", { name: /↑ Up/ })).toBeVisible();

  // Bounded by the commit appearing rather than by a round count: 1.B calls five bars on each of three
  // assets, and a hardcoded number of clicks would silently stop answering if that ever changed.
  const finish = page.getByRole("button", { name: /See how you did/i });
  for (let step = 0; step < 80 && (await finish.count()) === 0; step += 1) {
    const up = page.getByRole("button", { name: /↑ Up/ });
    if ((await up.count()) > 0) {
      await up.click();
      continue;
    }
    const next = page.getByRole("button", { name: /Next round/ });
    if ((await next.count()) === 0) break;
    await next.click();
  }

  await finish.click();
  // Two stars is the bar the next chapter is gated on, and participation should clear it outright.
  await expect.poll(async () => starsFor(page, "1-B")).toBeGreaterThanOrEqual(2);
}

test("a whole chapter can be played, and it opens the next one", async ({ page }) => {
  await page.goto("/");
  // Chapter 2 is shut before, open after. Asserted in both directions, or the test proves nothing.
  await expect(page.locator('a[href="/chapter/2"]')).toHaveCount(0);

  await playChapterOne(page);

  await page.goto("/");
  await expect(page.locator('a[href="/chapter/2"]')).toBeVisible();
  // And no further: clearing one boss opens exactly one chapter.
  await expect(page.locator('a[href="/chapter/3"]')).toHaveCount(0);
});

test("progress survives a reload mid-chapter", async ({ page }) => {
  await page.goto("/level/1-1");
  await page.getByRole("button", { name: /^body$/i }).click();
  await page.getByRole("button", { name: /commit answer/i }).click();
  await expect(page.getByText(/100%/)).toBeVisible();

  await page.reload();
  expect(await starsFor(page, "1-1")).toBe(3);

  // And the chapter map agrees with storage, which is the part a player actually sees.
  await page.goto("/chapter/1");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator('a[href="/level/1-2"]')).toBeVisible();
});

test("clearing storage mid-run degrades rather than crashing", async ({ page }) => {
  // **The failure this project has already been bitten by.** The M1 quota bug surfaced as progress
  // vanishing between screens, and the fix was `safe-storage.ts` — which never throws. A player whose
  // cache is cleared by the browser should meet a fresh game, not a broken one.
  await page.goto("/level/1-1");
  await page.getByRole("button", { name: /^body$/i }).click();
  await page.getByRole("button", { name: /commit answer/i }).click();
  expect(await starsFor(page, "1-1")).toBe(3);

  await page.evaluate((key) => window.localStorage.removeItem(key), KEY);
  await page.reload();

  // The page still works, and honestly reports that there is nothing there.
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.goto("/");
  await expect(page.locator('a[href="/chapter/1"]')).toBeVisible();
  await expect(page.locator('a[href="/chapter/2"]')).toHaveCount(0);
  await page.goto("/progress");
  await expect(page.getByText(/Nothing logged yet/)).toBeVisible();
});

test("a save survives being exported, wiped and imported", async ({ page }) => {
  // What makes export/import trustworthy rather than merely present: the whole loop, through the real
  // component, with the real validator.
  await page.goto("/level/1-1");
  await page.getByRole("button", { name: /^body$/i }).click();
  await page.getByRole("button", { name: /commit answer/i }).click();
  expect(await starsFor(page, "1-1")).toBe(3);

  await page.goto("/progress");
  // Build the file exactly as "Download a copy" writes it, from what the browser holds.
  const saveText = await page.evaluate((key) => {
    const held = JSON.parse(window.localStorage.getItem(key) ?? "{}");
    return JSON.stringify(
      { app: "chart-quest", schema: 1, exportedAt: new Date().toISOString(), state: held.state },
      null,
      2,
    );
  }, KEY);
  expect(saveText).toContain("1-1");

  // Erase it the way clearing site data would, then restore through the file input.
  await page.evaluate((key) => window.localStorage.removeItem(key), KEY);
  await page.reload();
  await expect(page.getByText(/Nothing logged yet/)).toBeVisible();

  await page
    .locator('input[type="file"]')
    .setInputFiles({
      name: "chart-quest.json",
      mimeType: "application/json",
      buffer: Buffer.from(saveText),
    });

  await expect(page.getByText(/Replace what is in this browser/)).toBeVisible();
  await page.getByRole("button", { name: /replace my progress/i }).click();

  await expect.poll(async () => starsFor(page, "1-1")).toBe(3);
  await page.goto("/");
  await expect(page.locator('a[href="/chapter/1"]')).toBeVisible();
});

test("a file that is not a save changes nothing, and says why", async ({ page }) => {
  await page.goto("/level/1-1");
  await page.getByRole("button", { name: /^body$/i }).click();
  await page.getByRole("button", { name: /commit answer/i }).click();

  await page.goto("/progress");
  await page
    .locator('input[type="file"]')
    .setInputFiles({
      name: "package.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify({ name: "some-project", version: "1.0.0" })),
    });

  const refusal = page.getByRole("alert").filter({ hasText: /Chart Quest save/i });
  await expect(refusal).toContainText(/not a Chart Quest save/i);
  await expect(refusal).toContainText(/Nothing has been changed/i);
  // The confirmation must never appear for a file that failed.
  await expect(page.getByText(/Replace what is in this browser/)).toHaveCount(0);
  expect(await starsFor(page, "1-1")).toBe(3);
});

test("the static build makes no runtime API calls", async ({ page }) => {
  // The whole game is offline-capable by design. Anything reaching a third party would be a
  // regression in the promise, not only in privacy.
  const external: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (!url.startsWith("http://localhost") && !url.startsWith("data:")) external.push(url);
  });

  await page.goto("/");
  await page.goto("/level/1-1");
  await page.goto("/progress");
  await page.goto("/strategy");
  await page.goto("/settings");

  expect(external, `unexpected external requests: ${external.join(", ")}`).toEqual([]);
});
