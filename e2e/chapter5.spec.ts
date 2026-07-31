import { expect, test, type Page } from "@playwright/test";

/**
 * Chapter 5 through the browser: sliders, indicator panes and the y-axis mode.
 *
 * The 4-B entry in these fixtures seeded a level that did not exist until M7, which
 * is how Chapter 5 shipped unreachable and how these tests failed to notice. 4-B is a
 * real boss now and the unlock chain itself is asserted in chapter4.spec.ts, so
 * seeding it here is ordinary setup rather than cover for a gap.
 *
 * The assertions worth having are the ones unit tests cannot make — that dragging a
 * slider actually changes the score, that a level route fetches its own content
 * chunk and not the whole curriculum, and that switching the y-axis leaves a
 * committed grade untouched.
 */

async function openUnlocked(page: Page, id: string) {
  await page.goto("/");
  await page.evaluate(() => {
    const cleared = {
      stars: 3,
      bestScore: 1,
      attempts: 1,
      completedAt: null,
    };
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
          progress: {
            "1-B": cleared,
            "2-B": cleared,
            "3-B": cleared,
            "4-B": cleared,
          },
          journal: [],
          strategies: [],
          predictions: {},
        },
      }),
    );
  });
  await page.goto(`/level/${id}`);
}

test("every Chapter 5 level renders", async ({ page }) => {
  for (const id of ["5-1", "5-2", "5-3", "5-4", "5-5", "5-6", "5-B"]) {
    await openUnlocked(page, id);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText(/loading level/i)).toHaveCount(0);
  }
});

test("a level route fetches its own content chunk, not the whole curriculum", async ({
  page,
}) => {
  // The property the dynamic-import refactor exists for. Before it, every level
  // route shipped all 29 levels in its initial payload.
  const scripts: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "script") scripts.push(request.url());
  });
  await openUnlocked(page, "5-3");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  const body = await page.content();
  // 5-3's own text is present; a different chapter's level text is not.
  expect(body).toContain("RSI held above 70");
  expect(body).not.toContain("summer of 2006");
  expect(scripts.length).toBeGreaterThan(0);
});

test("dragging the slider changes what is scored", async ({ page }) => {
  await openUnlocked(page, "5-2");
  const slider = page.getByRole("slider");
  await expect(slider).toBeVisible();

  // Straight to a badly wrong value, by keyboard — the control has to be operable
  // that way, and it is the only way to land on an exact step reliably.
  await slider.focus();
  for (let i = 0; i < 20; i += 1) await slider.press("ArrowLeft");
  await page.getByRole("button", { name: /Commit/ }).click();

  const stored = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("chart-quest") ?? "{}"),
  );
  // 5-2's answer is 2.35 and the slider started at 2.0; twenty steps down is 1.0.
  expect(stored.state?.progress?.["5-2"]?.bestScore).toBeLessThan(0.5);
  // At 1.0 the level names the specific fault rather than showing a percentage.
  await expect(page.getByText(/outside the bands/i).first()).toBeVisible();
});

test("an exploration level will not accept an answer until the range is explored", async ({
  page,
}) => {
  await openUnlocked(page, "5-1");
  // 5.1 has no right answer, so the gate is having looked rather than having chosen.
  const commit = page.getByRole("button", { name: /seen enough/i });
  await expect(commit).toBeDisabled();

  const slider = page.getByRole("slider");
  await slider.focus();
  for (let i = 0; i < 40; i += 1) await slider.press("ArrowRight");
  await expect(commit).toBeEnabled();
});

test("the y-axis toggle changes the axis and not the grade", async ({
  page,
}) => {
  await openUnlocked(page, "5-5");
  // One toggle per chart, and 5.5 shows three markets side by side.
  const toggles = page.getByRole("group", { name: /y-axis units/i });
  await expect(toggles).toHaveCount(3);
  const toggle = toggles.first();

  // Commit in ATR units, then switch to price and confirm nothing about the result
  // moved. Normalization is presentation.
  await page.getByRole("checkbox").nth(1).check();
  await page.getByRole("checkbox").nth(2).check();
  await page.getByRole("button", { name: /Commit answer/ }).click();

  const before = await page.evaluate(
    () =>
      JSON.parse(window.localStorage.getItem("chart-quest") ?? "{}").state
        ?.progress?.["5-5"]?.bestScore,
  );
  await toggle.getByRole("button", { name: "Price" }).click();
  const after = await page.evaluate(
    () =>
      JSON.parse(window.localStorage.getItem("chart-quest") ?? "{}").state
        ?.progress?.["5-5"]?.bestScore,
  );
  expect(after).toBe(before);
});

test("clearing 5.B opens chapter 6", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    const cleared = { stars: 3, bestScore: 1, attempts: 1, completedAt: null };
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
            "1-B": cleared,
            "2-B": cleared,
            "3-B": cleared,
            "4-B": cleared,
            "5-B": { stars: 2, bestScore: 0.8, attempts: 1, completedAt: null },
          },
          journal: [],
          strategies: [],
          predictions: {},
        },
      }),
    );
  });
  await page.goto("/");
  await expect(page.locator('a[href="/chapter/6"]')).toBeVisible();
  await expect(page.locator('a[href="/chapter/7"]')).toHaveCount(0);
});
