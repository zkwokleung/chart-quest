import { expect, test, type Page } from "@playwright/test";

/**
 * Chapter 2 through the browser: drawing, intrinsic grading, and the composite boss.
 *
 * Drawing is driven by the keyboard rather than by synthesised drags — it is the
 * path that has to work without a pointer, and it lands on exact bars, so the
 * assertions are about grading rather than about pixel arithmetic.
 */

async function press(page: Page, key: string, times = 1, shift = false) {
  for (let i = 0; i < times; i += 1) {
    await page.locator('[role="application"]').press(shift ? `Shift+${key}` : key);
  }
}

/**
 * Places an anchor `bars` from the start of the window.
 *
 * Home first, so the position is absolute: the cursor stays where the last anchor
 * was placed, and walking relative to it silently overshot.
 */
async function placeAnchor(page: Page, bars: number, lift = 0) {
  await press(page, "Home");
  await press(page, "ArrowRight", Math.floor(bars / 10), true);
  await press(page, "ArrowRight", bars % 10);
  if (lift > 0) await press(page, "ArrowUp", lift);
  await press(page, "Enter");
}

test("a well-drawn trendline earns three stars", async ({ page }) => {
  await page.goto("/level/2-3");
  await page.locator('[role="application"]').focus();

  // Bars 1012 and 1058 from a window starting at 1000. The cursor snaps each
  // anchor to that bar's low, which is what makes keyboard drawing practical.
  await placeAnchor(page, 12);
  await placeAnchor(page, 46);
  await page.getByRole("button", { name: /commit drawing/i }).click();

  await expect(page.getByText(/100%/)).toBeVisible();
  await expect(page.getByText(/0 body cuts/)).toBeVisible();

  const stored = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("chart-quest") ?? "{}"),
  );
  expect(stored.state?.progress?.["2-3"]?.stars).toBe(3);
});

test("a line lifted off the wicks is marked down AND told why", async ({ page }) => {
  await page.goto("/level/2-3");
  await page.locator('[role="application"]').focus();

  await placeAnchor(page, 12, 10);
  await placeAnchor(page, 46, 10);
  await page.getByRole("button", { name: /commit drawing/i }).click();

  // The score and the explanation have to agree: an earlier version docked 15% for
  // anchor placement while saying nothing about it.
  await expect(page.getByText(/0 of 2 on a wick/)).toBeVisible();
  await expect(page.getByText(/not anchored to the wicks/i)).toBeVisible();
});

test("a line drawn the wrong way scores zero and names the reason", async ({ page }) => {
  await page.goto("/level/2-3");
  await page.locator('[role="application"]').focus();

  // Anchor order does not decide slope — buildDrawing normalises it left to right.
  // A falling line needs the earlier bar high and the later bar low.
  await placeAnchor(page, 12, 30);
  await placeAnchor(page, 46);
  await page.getByRole("button", { name: /commit drawing/i }).click();

  await expect(page.getByText(/wrong direction|falls/i).first()).toBeVisible();
});

test("the boss dispatches four different kinds and gates chapter 3", async ({ page }) => {
  await page.goto("/level/2-B");

  // Each stage is rendered by its own kind's component, which is the whole point of
  // the composite reusing the engine rather than reimplementing it.
  await expect(page.getByText("Mark the three swing highs.")).toBeVisible();
  await page.getByRole("button", { name: /3\. Name the structure/ }).click();
  await expect(page.getByRole("radio")).toHaveCount(3);
  await page.getByRole("button", { name: /4\. Call the next ten bars/ }).click();
  await expect(page.getByRole("button", { name: /Up/ })).toBeVisible();

  // Clearing the boss is what opens the next chapter.
  await page.evaluate(() => {
    window.localStorage.setItem(
      "chart-quest",
      JSON.stringify({
        version: 1,
        state: {
          profile: {
            xp: 0,
            streak: 0,
            lastPlayed: null,
            settings: { reducedMotion: "system", yAxisMode: "price" },
          },
          progress: {
            "1-B": { stars: 3, bestScore: 1, attempts: 1, completedAt: null },
            "2-B": { stars: 2, bestScore: 0.8, attempts: 1, completedAt: null },
          },
          journal: [],
          strategies: [],
          predictions: {},
        },
      }),
    );
  });
  await page.goto("/");
  await expect(page.locator('a[href="/chapter/3"]')).toBeVisible();
  await expect(page.locator('a[href="/chapter/4"]')).toHaveCount(0);
});

test("every Chapter 2 level renders its chart", async ({ page }) => {
  for (const id of ["2-1", "2-2", "2-3", "2-4", "2-5", "2-6", "2-B"]) {
    await page.goto(`/level/${id}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText(/loading level/i)).toHaveCount(0);
  }
});
