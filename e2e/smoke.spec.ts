import { expect, test } from "@playwright/test";

const STORAGE_KEY = "chart-quest";

test("landing page renders the name and tagline", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Chart Quest");
  await expect(page.getByText(/one level at a time/i)).toBeVisible();
});

test("only chapter 1 is reachable on a fresh visit", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('a[href="/chapter/1"]')).toBeVisible();
  await expect(page.locator('a[href="/chapter/2"]')).toHaveCount(0);
});

test("progress survives a reload and opens the next chapter", async ({ page }) => {
  // Seeded before any script runs, so this exercises the real rehydrate path
  // rather than a store mutation.
  await page.addInitScript(
    ([key, payload]) => {
      window.localStorage.setItem(key as string, payload as string);
    },
    [
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        state: {
          profile: {
            xp: 300,
            streak: 1,
            lastPlayed: "2026-01-01T00:00:00.000Z",
            settings: { reducedMotion: "system", yAxisMode: "price" },
          },
          progress: {
            "1-B": {
              stars: 2,
              bestScore: 0.7,
              attempts: 2,
              completedAt: "2026-01-01T00:00:00.000Z",
            },
          },
          journal: [],
          strategies: [],
          predictions: {},
        },
      }),
    ],
  );

  await page.goto("/");

  // A cleared boss at two stars opens the next chapter; chapter 3 stays shut.
  await expect(page.locator('a[href="/chapter/2"]')).toBeVisible();
  await expect(page.locator('a[href="/chapter/3"]')).toHaveCount(0);

  await page.reload();
  await expect(page.locator('a[href="/chapter/2"]')).toBeVisible();
  // The hydration gate must resolve — a stuck gate would leave this visible.
  await expect(page.getByText(/loading progress/i)).toHaveCount(0);
});

test("levels unlock one at a time within a chapter", async ({ page }) => {
  await page.goto("/chapter/1");
  await expect(page.locator('a[href="/level/1-1"]')).toBeVisible();
  await expect(page.locator('a[href="/level/1-2"]')).toHaveCount(0);
  await expect(page.getByText("Locked").first()).toBeVisible();
});

test("an unknown level id is not served", async ({ page }) => {
  const response = await page.goto("/level/9-9");
  expect(response?.status()).toBe(404);
});
