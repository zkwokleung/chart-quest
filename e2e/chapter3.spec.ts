import { expect, test, type Page } from "@playwright/test";

/**
 * Chapter 3 through the browser: the replay engine, the seal, and the first trade.
 *
 * The assertions that matter here are the ones unit tests structurally cannot make:
 * that the transport actually moves the chart in both directions, that a bad stop is
 * punished *and the reason appears on screen*, and that the trade reaches localStorage
 * where Chapter 9 will look for it.
 */

/** Opens a level with Chapters 1-2 already cleared, so nothing is gated. */
async function openUnlocked(page: Page, id: string) {
  await page.goto("/");
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
            settings: { reducedMotion: false, yAxisMode: "price" },
          },
          progress: {
            "1-B": { stars: 3, bestScore: 1, attempts: 1, completedAt: null },
            "2-B": { stars: 3, bestScore: 1, attempts: 1, completedAt: null },
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

test("every Chapter 3 level renders its chart", async ({ page }) => {
  for (const id of ["3-1", "3-2", "3-3", "3-4", "3-5", "3-6", "3-B"]) {
    await openUnlocked(page, id);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText(/loading level/i)).toHaveCount(0);
  }
});

test("the replay reveals bars and scrubbing goes both ways", async ({
  page,
}) => {
  await openUnlocked(page, "3-B");
  const readout = page.locator("p.font-mono").filter({ hasText: /revealed/ });
  await expect(readout).toBeVisible();

  const barOf = async () => {
    const text = (await readout.textContent()) ?? "";
    return Number(/bar (\d+)/.exec(text)?.[1] ?? "0");
  };

  const start = await barOf();
  await page.getByRole("button", { name: "+10" }).click();
  const after = await barOf();
  expect(after).toBe(start + 10);

  // Backwards, which is the whole reason the chart rebuilds rather than appending.
  await page
    .locator('[role="group"][aria-label^="Replay controls"]')
    .press("ArrowLeft");
  expect(await barOf()).toBe(after - 1);

  await page.getByRole("button", { name: /Rewind/ }).click();
  expect(await barOf()).toBe(start);
});

test("a crammed stop is punished and told why", async ({ page }) => {
  // Not the plan-cap test, deliberately. The cap needs a trade that *wins* on a
  // stupid stop, and 3.B's window contains no such trade: price trades down to
  // 24,255 on the very next bar, so any stop crammed near entry is taken out before
  // the run. That is good for the level — the market agrees with the grader — but it
  // means the cap can only be demonstrated on a constructed market, which is where
  // its unit test lives. What the browser can show is that the punishment lands and
  // the reason is on screen.
  await openUnlocked(page, "3-B");

  for (let i = 0; i < 9; i += 1) {
    await page.getByRole("button", { name: "Raise stop" }).click();
  }
  await page
    .getByRole("textbox")
    .fill("Buying the pullback because it looks strong.");
  await page.getByRole("button", { name: /Take the trade/ }).click();

  const stored = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("chart-quest") ?? "{}"),
  );
  expect(stored.state?.progress?.["3-B"]?.stars).toBeLessThanOrEqual(1);
  // The stop sat where everyone else's was, and the diagnosis says so rather than
  // leaving the player to infer it from a percentage.
  await expect(
    page.getByText(/every other stop in this market/i),
  ).toBeVisible();
  expect(stored.state?.journal?.[0]?.r).toBeLessThanOrEqual(-1);
});

test("a committed trade lands in the journal with its stated reason", async ({
  page,
}) => {
  await openUnlocked(page, "3-B");

  // A defensible stop: below the pullback low with room.
  for (let i = 0; i < 4; i += 1) {
    await page.getByRole("button", { name: "Lower stop" }).click();
  }
  for (let i = 0; i < 6; i += 1) {
    await page.getByRole("button", { name: "Raise target" }).click();
  }
  const reason =
    "Pullback into support after a strong run, stop below the swing low.";
  await page.getByRole("textbox").fill(reason);
  await page.getByRole("button", { name: /Take the trade/ }).click();

  const stored = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("chart-quest") ?? "{}"),
  );
  const journal = stored.state?.journal ?? [];
  expect(journal).toHaveLength(1);
  // Chapter 9.6 splits by asset class and reads the reasons back, so both have to
  // be present from the very first trade.
  expect(journal[0].reason).toBe(reason);
  expect(journal[0].seriesId).toBe("BTCUSDT-4h");
  expect(journal[0].assetClass).toBe("crypto-spot");
  expect(journal[0].attemptNo).toBe(1);
  expect(typeof journal[0].r).toBe("number");
});

test("the trade cannot be taken without a reason", async ({ page }) => {
  await openUnlocked(page, "3-B");
  for (let i = 0; i < 4; i += 1) {
    await page.getByRole("button", { name: "Lower stop" }).click();
  }
  // A stop is placed but nothing is written, so the commit stays disabled.
  await expect(
    page.getByRole("button", { name: /Take the trade/ }),
  ).toBeDisabled();
  await page
    .getByRole("textbox")
    .fill("Because the chart looks good to me here.");
  await expect(
    page.getByRole("button", { name: /Take the trade/ }),
  ).toBeEnabled();
});

test("3.4 hides the outcome until the answer is committed", async ({
  page,
}) => {
  await openUnlocked(page, "3-4");
  const charts = page.locator("figure");
  await expect(charts).toHaveCount(6);

  // Six charts, each labelled, and the reveal notes absent until commit.
  await expect(page.getByText(/twenty bars on/).first()).toHaveCount(0);
  await page.getByRole("checkbox").first().check();
  await page.getByRole("button", { name: /Commit answer/ }).click();
  await expect(page.getByText(/twenty bars on/).first()).toBeVisible();
});

test("clearing 3.B opens chapter 4 and leaves 5 locked", async ({ page }) => {
  await page.goto("/");
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
            "2-B": { stars: 3, bestScore: 1, attempts: 1, completedAt: null },
            "3-B": { stars: 2, bestScore: 0.8, attempts: 1, completedAt: null },
          },
          journal: [],
          strategies: [],
          predictions: {},
        },
      }),
    );
  });
  await page.goto("/");
  await expect(page.locator('a[href="/chapter/4"]')).toBeVisible();
  await expect(page.locator('a[href="/chapter/5"]')).toHaveCount(0);
});
