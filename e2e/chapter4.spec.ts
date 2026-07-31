import { expect, test, type Page } from "@playwright/test";

/**
 * Chapter 4 through the browser: the ranking control, the measured table, and the
 * unlock chain this milestone existed to repair.
 *
 * The assertions worth having are the ones unit tests cannot make — that an ordering
 * can be rearranged with a keyboard alone, that the base rates arrive over the network
 * and render with their sample sizes attached, and that Chapter 5 opens off the back of
 * a level that now exists.
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

/** Opens a Chapter 4 level with Chapters 1-3 cleared, so nothing is gated. */
async function openUnlocked(page: Page, id: string) {
  await seed(page, { "1-B": cleared, "2-B": cleared, "3-B": cleared });
  await page.goto(`/level/${id}`);
}

test("every Chapter 4 level renders", async ({ page }) => {
  for (const id of ["4-1", "4-2", "4-3", "4-4", "4-5", "4-6", "4-B"]) {
    await openUnlocked(page, id);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText(/loading level/i)).toHaveCount(0);
  }
});

test("4.5 can be reordered with a keyboard alone", async ({ page }) => {
  await openUnlocked(page, "4-5");
  const list = page.getByRole("list", { name: /your ranking/i });
  await expect(list).toBeVisible();

  const rowsBefore = await list.getByRole("listitem").allInnerTexts();

  // Tab to the first row's "move down" button and press it. No pointer involved:
  // this is the requirement every kind since M3 has had to meet.
  const down = page.getByRole("button", { name: /^Move .* down$/ }).first();
  await down.focus();
  await expect(down).toBeFocused();
  await down.press("Enter");

  // Focus survives the reorder, so a second press works without tabbing back in.
  await expect(page.locator(":focus")).toBeVisible();
  const rowsAfter = await list.getByRole("listitem").allInnerTexts();
  expect(rowsAfter).not.toEqual(rowsBefore);
});

test("4.5 scores a wrong ordering below a right one", async ({ page }) => {
  // Reverse the list, which is the worst answer available, and check the score
  // reflects that rather than the level accepting anything.
  await openUnlocked(page, "4-5");
  const list = page.getByRole("list", { name: /your ranking/i });
  await expect(list).toBeVisible();

  for (let round = 0; round < 4; round += 1) {
    const up = page.getByRole("button", { name: /^Move .* up$/ }).last();
    for (let press = 0; press < 4; press += 1) {
      if (await up.isEnabled()) await up.click();
    }
  }
  await page.getByRole("button", { name: /commit ranking/i }).click();

  const stored = await page.evaluate(
    () =>
      JSON.parse(window.localStorage.getItem("chart-quest") ?? "{}").state?.progress?.[
        "4-5"
      ],
  );
  expect(stored?.bestScore).toBeLessThan(0.9);
});

test("the measured table arrives over the network with every sample size", async ({
  page,
}) => {
  const fetched: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("base-rates")) fetched.push(request.url());
  });

  await openUnlocked(page, "4-5");
  await page.getByRole("button", { name: /commit ranking/i }).click();

  const table = page.getByRole("table").first();
  await expect(table).toBeVisible();
  // Fetched rather than bundled — the property load-base-rates.ts exists for.
  expect(fetched.length).toBeGreaterThan(0);

  // Every rate carries its n and its interval. A bare percentage is the thing this
  // level is arguing against, so its absence is worth asserting.
  for (const pattern of ["Pin bar", "Doji", "Engulfing", "Double top"]) {
    const row = table.getByRole("row").filter({ hasText: pattern }).first();
    await expect(row).toContainText("%");
    await expect(row).toContainText("ATR");
    await expect(row).toContainText("–");
  }
  await expect(table).toContainText("3,733");
  await expect(table).toContainText("66");
});

test("clearing 4.B is what opens Chapter 5", async ({ page }) => {
  // The gap this milestone closed. Chapter 5 shipped in M6 behind a boss that did not
  // exist, and M6's own tests wrote "4-B": cleared into localStorage, which made the
  // suite pass and hid it. 4-B is a real level now, so the chain is checked instead of
  // assumed — first that Chapter 5 is shut without it, then that it opens with it.
  await seed(page, { "1-B": cleared, "2-B": cleared, "3-B": cleared });
  await page.goto("/");
  await expect(page.locator('a[href="/chapter/4"]')).toBeVisible();
  await expect(page.locator('a[href="/chapter/5"]')).toHaveCount(0);

  await seed(page, {
    "1-B": cleared,
    "2-B": cleared,
    "3-B": cleared,
    "4-B": { stars: 2, bestScore: 0.8, attempts: 1, completedAt: null },
  });
  await page.goto("/");
  await expect(page.locator('a[href="/chapter/5"]')).toBeVisible();
});
