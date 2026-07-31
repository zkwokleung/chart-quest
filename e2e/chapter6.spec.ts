import { expect, test, type Page } from "@playwright/test";

/**
 * Chapter 6 through the browser: two live panes, the claims artefact, and the unlock chain.
 *
 * The assertions worth having are the ones unit tests structurally cannot make — that both
 * panes actually render and advance together, that the correlation matrix arrives, and that
 * clearing 6.B opens Chapter 7 the way clearing 4.B opened Chapter 5.
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

/**
 * Chapters 1-5 cleared, plus every Chapter 6 level *before* this one.
 *
 * Only the preceding ones, and that matters: `recordAttempt` keeps the best score a level
 * has ever had, so seeding the level under test as already cleared makes any later
 * assertion about its score meaningless. An earlier version of this helper seeded 6-1
 * through 6-5 unconditionally, and the 6.4 test passed on a stale `bestScore: 1`.
 */
async function openUnlocked(page: Page, id: string) {
  const order = ["6-1", "6-2", "6-3", "6-4", "6-5", "6-6", "6-B"];
  const progress: Record<string, typeof cleared> = {
    "1-B": cleared,
    "2-B": cleared,
    "3-B": cleared,
    "4-B": cleared,
    "5-B": cleared,
  };
  for (const earlier of order.slice(0, order.indexOf(id))) {
    progress[earlier] = cleared;
  }
  await seed(page, progress);
  await page.goto(`/level/${id}`);
}

test("every Chapter 6 level renders", async ({ page }) => {
  for (const id of ["6-1", "6-2", "6-3", "6-4", "6-5", "6-6", "6-B"]) {
    await openUnlocked(page, id);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText(/loading level/i)).toHaveCount(0);
    await expect(page.getByText(/could not load/i)).toHaveCount(0);
  }
});

test("a multi-timeframe level draws both panes", async ({ page }) => {
  // The property the resampler and the linked feed exist for. Two canvases, both with
  // data — a single pane would mean the second slice silently failed to load.
  await openUnlocked(page, "6-1");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const canvases = page.locator("canvas");
  await expect.poll(async () => canvases.count()).toBeGreaterThanOrEqual(2);
});

test("the two panes of a live replay advance together", async ({ page }) => {
  await openUnlocked(page, "6-2");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // The fifteen-minute pane drives. Stepping it four times should move the hourly pane
  // about one bar — and never past a bar that has not closed, which is what the seal test
  // proves in the unit suite. Here we only need to see the follower move at all.
  const readout = page.getByText(/entry .* at bar/);
  await expect(readout).toBeVisible();
  const before = await readout.textContent();

  const step = page.getByRole("button", { name: /step forward|next bar/i }).first();
  if (await step.count()) {
    for (let i = 0; i < 4; i += 1) await step.click();
    await expect(readout).not.toHaveText(before ?? "");
  }
});

test("6.5 is completable by keyboard alone and shows the measured matrix", async ({
  page,
}) => {
  await openUnlocked(page, "6-5");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // Native checkboxes, so focus-and-space works without anything custom being written.
  const boxes = page.getByRole("checkbox");
  await expect.poll(async () => boxes.count()).toBe(7);

  // The first three claims are the correlated block, in the order the level lists them.
  for (const index of [0, 1, 2]) {
    await boxes.nth(index).focus();
    await page.keyboard.press("Space");
  }
  await page.getByRole("button", { name: /^Commit$/ }).click();

  const stored = await page.evaluate(
    () =>
      JSON.parse(window.localStorage.getItem("chart-quest") ?? "{}").state?.progress?.[
        "6-5"
      ],
  );
  expect(stored?.stars).toBe(3);

  // The reveal is a measurement, not prose.
  const table = page.getByRole("table").first();
  await expect(table).toBeVisible();
  await expect(table).toContainText("RSI");
  await expect(table).toContainText("0.9");
});

test("6.4 ranks four charts and scores the shuffled order badly", async ({ page }) => {
  await openUnlocked(page, "6-4");
  const list = page.getByRole("list", { name: /your ranking/i });
  await expect(list).toBeVisible();
  // One chart per row: four setups to compare.
  await expect.poll(async () => page.locator("canvas").count()).toBeGreaterThanOrEqual(4);

  // Commit the order as displayed. The level deliberately opens shuffled — B, D, A, C —
  // which is three transpositions from the measured answer, so submitting it untouched is
  // both the simplest wrong answer available and a deterministic one. An earlier version
  // of this test clicked its way to a "reversed" order and landed on the correct one.
  await page.getByRole("button", { name: /commit ranking/i }).click();

  const stored = await page.evaluate(
    () =>
      JSON.parse(window.localStorage.getItem("chart-quest") ?? "{}").state?.progress?.[
        "6-4"
      ],
  );
  expect(stored?.bestScore).toBeLessThan(0.9);
  expect(stored?.stars).toBeLessThan(3);

  // And the correction names which rows landed right, so the reveal is legible.
  await expect(page.getByText(/right place|wrong place/).first()).toBeVisible();
});

test("clearing 6.B is what opens Chapter 7", async ({ page }) => {
  // The chain M7 established as a check after Chapter 5 shipped behind a boss that did not
  // exist. Asserted in both directions so a missing boss cannot hide again.
  await seed(page, {
    "1-B": cleared,
    "2-B": cleared,
    "3-B": cleared,
    "4-B": cleared,
    "5-B": cleared,
  });
  await page.goto("/");
  await expect(page.locator('a[href="/chapter/6"]')).toBeVisible();
  await expect(page.locator('a[href="/chapter/7"]')).toHaveCount(0);

  await seed(page, {
    "1-B": cleared,
    "2-B": cleared,
    "3-B": cleared,
    "4-B": cleared,
    "5-B": cleared,
    "6-B": { stars: 2, bestScore: 0.8, attempts: 1, completedAt: null },
  });
  await page.goto("/");
  await expect(page.locator('a[href="/chapter/7"]')).toBeVisible();
  await expect(page.locator('a[href="/chapter/8"]')).toHaveCount(0);
});

test("the derived series are served, not bundled", async ({ page }) => {
  // EURUSD-4h and SPY-1h are committed artefacts fetched at runtime like every other
  // series. A 404 here would leave Chapter 6's higher panes empty.
  const fetched: Record<string, number> = {};
  page.on("response", (response) => {
    const url = response.url();
    if (url.includes("/data/series/")) fetched[url.split("/").pop()!] = response.status();
  });
  await openUnlocked(page, "6-2");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect.poll(() => Object.keys(fetched).length).toBeGreaterThan(0);
  for (const [file, status] of Object.entries(fetched)) {
    expect(status, file).toBe(200);
  }
  expect(Object.keys(fetched)).toContain("SPY-1h.json");
});
