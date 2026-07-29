import { expect, test } from "@playwright/test";

/**
 * Plays Chapter 1 through the browser, covering what unit tests cannot: that a
 * level renders its real data, that a wrong answer produces a named explanation,
 * that a hint visibly costs a star, and that clearing the boss opens Chapter 2.
 */

test("a wrong answer explains itself rather than just scoring", async ({ page }) => {
  await page.goto("/level/1-1");

  await page.getByRole("button", { name: /upper wick/i }).click();
  await page.getByRole("button", { name: /commit answer/i }).click();

  // The product's whole premise: the feedback names the mistake.
  await expect(page.getByText(/that is a wick/i)).toBeVisible();
  await expect(page.getByText(/0%/)).toBeVisible();
  // Both the answer and the player's wrong pick stay on screen.
  await expect(page.getByRole("button", { name: /body/i })).toBeVisible();
});

test("a correct answer earns stars and records them", async ({ page }) => {
  await page.goto("/level/1-1");

  await page.getByRole("button", { name: /^body$/i }).click();
  await page.getByRole("button", { name: /commit answer/i }).click();

  await expect(page.getByText(/100%/)).toBeVisible();

  const stored = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("chart-quest") ?? "{}"),
  );
  expect(stored.state?.progress?.["1-1"]?.stars).toBe(3);
});

test("taking a hint caps the stars before the answer is committed", async ({ page }) => {
  await page.goto("/level/1-2");

  await page.getByRole("button", { name: /reveal a hint/i }).click();
  await expect(page.getByText(/best possible now: 2 stars/i)).toBeVisible();

  await page.getByRole("radio").nth(1).check();
  await page.getByRole("button", { name: /commit answer/i }).click();

  const stored = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("chart-quest") ?? "{}"),
  );
  // A perfect answer after one hint is worth two stars, not three.
  expect(stored.state?.progress?.["1-2"]?.stars).toBe(2);
});

test("the boss awards full stars for finishing, however wrong the calls", async ({
  page,
}) => {
  await page.goto("/level/1-B");

  for (let round = 0; round < 5; round += 1) {
    await page.getByRole("button", { name: /down/i }).click();
    const next = page.getByRole("button", { name: /next round/i });
    if (await next.isVisible().catch(() => false)) await next.click();
  }
  await page.getByRole("button", { name: /see how you did/i }).click();

  // Calling "down" five times is near-certainly wrong, and must still clear the
  // level: 1.B measures whether the player took a position, not whether it paid.
  await expect(page.getByText(/100%/)).toBeVisible();

  const stored = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("chart-quest") ?? "{}"),
  );
  expect(stored.state?.progress?.["1-B"]?.stars).toBe(3);
  // The accuracy is kept for Chapter 9 to hand back.
  expect(stored.state?.predictions?.["1-B"]).toHaveProperty("accuracy");

  await page.goto("/");
  await expect(page.locator('a[href="/chapter/2"]')).toBeVisible();
  await expect(page.locator('a[href="/chapter/3"]')).toHaveCount(0);
});

test("every Chapter 1 level renders its chart", async ({ page }) => {
  for (const id of ["1-1", "1-2", "1-3", "1-4", "1-5", "1-6", "1-7", "1-B"]) {
    await page.goto(`/level/${id}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText(/loading level/i)).toHaveCount(0);
  }
});
