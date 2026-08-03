import { expect, test, type Page } from "@playwright/test";

/**
 * Chapter 7 through the browser: two new kinds, and the last unlock in the chain.
 *
 * The assertions worth having are the ones the unit suite structurally cannot make. Two matter
 * more than usual here. `sizing-calc` and `trade-sequence` are the first kinds to ship *after*
 * kind components became lazy imports, so "the level renders at all" is now a real question
 * rather than a formality — a missing entry in `components.ts` fails only in a browser, behind
 * a Suspense boundary, and every unit test would still pass.
 *
 * The second is 7.B's reveal-as-you-go: the whole level depends on the player not seeing trade
 * six's outcome until trade six is sized, and nothing in a grader test can check that.
 */

const cleared = { stars: 3, bestScore: 1, attempts: 1, completedAt: null };

async function seed(page: Page, progress: Record<string, typeof cleared>) {
  await page.goto("/");
  await page.evaluate((entries) => {
    window.localStorage.setItem(
      "chart-quest",
      JSON.stringify({
        version: 1,
        state: {
          profile: {
            xp: 0,
            streak: 0,
            lastPlayed: null,
            settings: { reducedMotion: false, yAxisMode: "price" },
          },
          progress: entries,
          journal: [],
          strategies: [],
          predictions: {},
        },
      }),
    );
  }, progress);
}

const BOSSES = ["1-B", "2-B", "3-B", "4-B", "5-B", "6-B"];
const ORDER = ["7-1", "7-2", "7-3", "7-4", "7-5", "7-6", "7-7", "7-B"];

/**
 * Every chapter cleared, plus every Chapter 7 level *before* this one.
 *
 * Only the preceding ones. `recordAttempt` keeps a level's best score forever, so seeding the
 * level under test as cleared makes any later assertion about its score meaningless — the bug
 * that made two of Chapter 6's tests pass for the wrong reason.
 */
async function openUnlocked(page: Page, id: string) {
  const progress: Record<string, typeof cleared> = {};
  for (const boss of BOSSES) progress[boss] = cleared;
  for (const earlier of ORDER.slice(0, ORDER.indexOf(id))) progress[earlier] = cleared;
  await seed(page, progress);
  await page.goto(`/level/${id}`);
}

async function storedProgress(page: Page, id: string) {
  return page.evaluate(
    (levelId) =>
      JSON.parse(window.localStorage.getItem("chart-quest") ?? "{}").state?.progress?.[
        levelId
      ] as { stars?: number; bestScore?: number } | undefined,
    id,
  );
}

test("every Chapter 7 level renders", async ({ page }) => {
  // Including past the Suspense boundary: a kind missing from the lazy component map resolves
  // to a permanent fallback, which is exactly what "loading level" would still be showing.
  for (const id of ORDER) {
    await openUnlocked(page, id);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText(/loading level/i)).toHaveCount(0);
    await expect(page.getByText(/could not load/i)).toHaveCount(0);
    await expect(page.getByText(/not authored yet/i)).toHaveCount(0);
  }
});

test("a sizing level is completable by keyboard alone", async ({ page }) => {
  // Native number inputs, so tab-and-type works with nothing custom written for it — the same
  // reasoning that made spot-the-flaw use real checkboxes.
  await openUnlocked(page, "7-2");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  const inputs = page.getByRole("spinbutton");
  await expect.poll(async () => inputs.count()).toBe(3);

  for (const [index, answer] of ["0.125", "0.25", "0.5"].entries()) {
    await inputs.nth(index).focus();
    await page.keyboard.type(answer);
  }
  await page.getByRole("button", { name: /^Commit sizes?$/ }).click();

  expect((await storedProgress(page, "7-2"))?.stars).toBe(3);
});

test("7.3 accepts zero as an answer, because zero is the answer", async ({ page }) => {
  // The level's whole argument: one gold contract risks more than the account may lose, so the
  // correct size is none. If the input or the grader treated a typed 0 as "unanswered", the
  // level would be unwinnable in the browser while passing every unit test.
  await openUnlocked(page, "7-3");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  const inputs = page.getByRole("spinbutton");
  await expect.poll(async () => inputs.count()).toBe(4);
  for (const [index, answer] of ["0.5", "125", "0", "0.22"].entries()) {
    await inputs.nth(index).fill(answer);
  }
  await page.getByRole("button", { name: /^Commit sizes?$/ }).click();

  expect((await storedProgress(page, "7-3"))?.stars).toBe(3);
  await expect(page.getByText(/4 of 4/)).toBeVisible();
});

test("7.3 shows each instrument's contract terms beside its row", async ({ page }) => {
  // The level asks why one formula gives four answers. It cannot, if the number that makes
  // them different is off screen.
  await openUnlocked(page, "7-3");
  const rows = page.getByRole("listitem");
  await expect(rows.filter({ hasText: /per point/ })).toHaveCount(4);
  await expect(page.getByText(/100 USD per point/)).toBeVisible();
});

test("7.B reveals one trade at a time and moves the account underneath", async ({
  page,
}) => {
  await openUnlocked(page, "7-B");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // Nothing about trade one's result is on screen before trade one is sized.
  await expect(page.getByText(/trade 1 of 10/i)).toBeVisible();
  await expect(page.getByText(/^\+?-?\d+\.\d\dR$/)).toHaveCount(0);
  await expect(page.getByText(/start 25,000/)).toBeVisible();

  const twoPercent = page.getByRole("button", { name: "2%", exact: true });
  await twoPercent.click();
  await expect(page.getByText(/trade 2 of 10/i)).toBeVisible();

  // The account has moved, and by the first trade's result rather than by nothing.
  await expect(page.getByText(/you have 24,500/)).toBeVisible();

  for (let i = 0; i < 9; i += 1) {
    await page.getByRole("button", { name: "2%", exact: true }).click();
  }

  // Ten disciplined decisions is the reference attempt, so it scores three stars — and the
  // sequence finished richer, which is the level's point rather than a bug.
  expect((await storedProgress(page, "7-B"))?.stars).toBe(3);
  await expect(page.getByText(/finished 29,483/)).toBeVisible();
  await expect(page.getByText(/10 of 10/)).toBeVisible();
});

test("7.B scores recklessness worse even though it finishes richer", async ({ page }) => {
  // The chapter's hardest claim, and the one a player is most likely to disbelieve. Worth an
  // end-to-end check because it is the only place the two numbers appear together on screen.
  await openUnlocked(page, "7-B");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  for (let i = 0; i < 10; i += 1) {
    await page.getByRole("button", { name: "10%", exact: true }).click();
  }

  const reckless = await storedProgress(page, "7-B");
  expect(reckless?.stars).toBeLessThan(3);
  expect(reckless?.bestScore).toBeLessThan(0.95);
  // Double the money, and a worse grade.
  await expect(page.getByText(/finished 50,944/)).toBeVisible();
  await expect(page.getByText(/0 of 10/)).toBeVisible();
});

test("7.B names the trade where risk went up after a loss", async ({ page }) => {
  // Trade 1 loses, so raising on trade 2 is the martingale. The correction has to point at the
  // decision rather than at the sequence — and the misconception used to fire after wins too.
  await openUnlocked(page, "7-B");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  await page.getByRole("button", { name: "1%", exact: true }).click();
  await page.getByRole("button", { name: "5%", exact: true }).click();
  for (let i = 0; i < 8; i += 1) {
    await page.getByRole("button", { name: "1%", exact: true }).click();
  }

  await expect(page.getByText(/raised after a loss/).first()).toBeVisible();
  await expect(page.getByText(/raised risk after a loss/)).toBeVisible();
});

test("clearing 7.B is what opens Chapter 8", async ({ page }) => {
  // Asserted in both directions, and reached by *playing* 7.B rather than by seeding it — the
  // check that would have caught Chapter 5 shipping behind a boss that did not exist.
  const throughSix: Record<string, typeof cleared> = {};
  for (const boss of BOSSES) throughSix[boss] = cleared;
  for (const id of ORDER.slice(0, -1)) throughSix[id] = cleared;

  await seed(page, throughSix);
  await page.goto("/");
  await expect(page.locator('a[href="/chapter/7"]')).toBeVisible();
  await expect(page.locator('a[href="/chapter/8"]')).toHaveCount(0);

  await page.goto("/level/7-B");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  for (let i = 0; i < 10; i += 1) {
    await page.getByRole("button", { name: "2%", exact: true }).click();
  }
  expect((await storedProgress(page, "7-B"))?.stars).toBeGreaterThanOrEqual(2);

  await page.goto("/");
  await expect(page.locator('a[href="/chapter/8"]')).toBeVisible();
  await expect(page.locator('a[href="/chapter/9"]')).toHaveCount(0);
});

test("a sizing level fetches no series, because it has none", async ({ page }) => {
  // 7.1 to 7.3 name no data on purpose: sizing is arithmetic over a contract spec. If one of
  // them started fetching a series it would mean a slice crept into the level file, which is
  // also what would put gold back inside the cross-asset boss guard.
  const fetched: string[] = [];
  page.on("response", (response) => {
    const url = response.url();
    if (url.includes("/data/series/")) fetched.push(url.split("/").pop()!);
  });
  await openUnlocked(page, "7-1");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("spinbutton")).toHaveCount(3);
  expect(fetched).toEqual([]);
});
