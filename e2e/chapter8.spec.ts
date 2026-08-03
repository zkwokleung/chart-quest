import { expect, test, type Page } from "@playwright/test";

/**
 * Chapter 8 through the browser: a twelfth lazy kind, three fetched reveals, and the last
 * unlock in the chain.
 *
 * Two things here cannot be reached from the unit suite at all. The `probe` component is the
 * first kind added since kind components became lazy imports *and* the first that fetches a
 * committed artefact to render anything — so "the readout has numbers in it" is a real
 * question spanning Suspense, a network request and a parse. And the y-axis unlock is
 * progress-gated, which means its correctness is a property of two pages at once: the control
 * has to appear on a Chapter 1 level *after* Chapter 8 opens and not before.
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

const BOSSES = ["1-B", "2-B", "3-B", "4-B", "5-B", "6-B", "7-B"];
const ORDER = ["8-1", "8-2", "8-3", "8-4", "8-5", "8-6", "8-B"];

/** Every chapter cleared, plus every Chapter 8 level *before* this one. */
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

test("every Chapter 8 level renders", async ({ page }) => {
  for (const id of ORDER) {
    await openUnlocked(page, id);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText(/loading level/i)).toHaveCount(0);
    await expect(page.getByText(/could not load/i)).toHaveCount(0);
    await expect(page.getByText(/not authored yet/i)).toHaveCount(0);
  }
});

test("8.1 compares five markets and offers the axis control on each", async ({ page }) => {
  await openUnlocked(page, "8-1");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // Five panes, because holding Apple back for the boss is what makes it five.
  await expect.poll(async () => page.locator("canvas").count()).toBeGreaterThanOrEqual(5);
  // And the toggle the chapter unlocks, on every one of them.
  await expect(page.getByRole("button", { name: "ATR" })).toHaveCount(5);
});

test("8.2's readout is measured, and moves when the control moves", async ({ page }) => {
  // The assertion the unit suite structurally cannot make: Suspense resolved, the artefact
  // fetched, the JSON parsed and the numbers on screen. A missing entry in `components.ts`, a
  // 404 on the artefact or a parse failure all look identical from `lib/`.
  await openUnlocked(page, "8-2");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  const table = page.getByRole("table");
  await expect(table).toBeVisible();
  await expect(page.getByText(/Measuring…/)).toHaveCount(0);
  // Bitcoin at a two-bar horizon is below one, which is where the level starts on purpose.
  await expect(table).toContainText("0.949");

  const control = page.getByRole("slider");
  await expect(control).toBeVisible();
  await control.focus();
  for (let i = 0; i < 40; i += 1) await page.keyboard.press("ArrowRight");

  // The same row, recomputed. If the readout were static this would still say 0.949.
  await expect(table).not.toContainText("0.949");
});

test("8.2 is completable by keyboard alone, and refuses a lucky answer", async ({
  page,
}) => {
  await openUnlocked(page, "8-2");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  const commit = page.getByRole("button", { name: /^Commit/ });
  // Nothing swept yet, so there is nothing to commit — issue #26's requirement made part of
  // the interaction rather than explained afterwards in a score.
  await expect(commit).toBeDisabled();

  const control = page.getByRole("slider");
  await control.focus();
  // All the way right, then back to the crossing at 6.
  for (let i = 0; i < 95; i += 1) await page.keyboard.press("ArrowRight");
  await expect(commit).toBeEnabled();
  for (let i = 0; i < 95; i += 1) await page.keyboard.press("ArrowLeft");
  for (let i = 0; i < 4; i += 1) await page.keyboard.press("ArrowRight");

  await commit.click();
  expect((await storedProgress(page, "8-2"))?.stars).toBe(3);
});

test("8.4's reveal switches between all days and the days that mattered", async ({
  page,
}) => {
  await openUnlocked(page, "8-4");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // Four panes on one date range.
  await expect.poll(async () => page.locator("canvas").count()).toBeGreaterThanOrEqual(4);

  // Classify renders radios inside labels, then a commit button.
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: /commit answer/i }).click();
  const matrix = page.getByRole("table").last();
  await expect(matrix).toBeVisible();
  await expect(page.getByText(/1,?429 days|1429 days/)).toBeVisible();

  // The switch is the lesson, so it has to work.
  await page.getByRole("button", { name: /worst 10%/i }).click();
  await expect(
    page.getByText(/the days a diversified book is supposed to be for/).first(),
  ).toBeVisible();
  expect((await storedProgress(page, "8-4"))?.stars).toBe(3);
});

test("8.5 keeps its verdicts back until the review is committed", async ({ page }) => {
  // **A shipped level was answering itself.** Every `spot-the-flaw` claim carries a `note` that is
  // a verdict — "The premise is true and the conclusion is not" — and the component rendered them
  // beside the checkboxes from M6 until 9.B's stages made it obvious in a browser. Nothing in the
  // unit suite could see it: the grader is pure and the notes are content.
  await openUnlocked(page, "8-5");
  const verdict = page.getByText(/The premise is true and the conclusion is not/);
  await expect(page.getByRole("checkbox").first()).toBeVisible();
  await expect(verdict).toHaveCount(0);

  await page.getByRole("checkbox").nth(2).check();
  await page.getByRole("button", { name: /^commit$/i }).click();
  await expect(verdict).toBeVisible();
});

test("8.6 shows the edge that has no setups at all", async ({ page }) => {
  // The chapter's only claim with no sample size attached, and the one place a "0.00" instead
  // of "none" would quietly turn an impossible edge into a break-even one.
  await openUnlocked(page, "8-6");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("button", { name: /commit ranking/i }).click();

  const grid = page.getByRole("table").last();
  await expect(grid).toBeVisible();
  await expect(grid).toContainText("none");
});

test("the y-axis toggle appears on a Chapter 1 level only once Chapter 8 is open", async ({
  page,
}) => {
  // Asserted in both directions on the *same* level, because the control being progress-gated
  // means neither half proves anything alone.
  await seed(page, { "1-B": cleared });
  await page.goto("/level/1-2");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "ATR" })).toHaveCount(0);

  const throughSeven: Record<string, typeof cleared> = {};
  for (const boss of BOSSES) throughSeven[boss] = cleared;
  await seed(page, throughSeven);
  await page.goto("/level/1-2");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "ATR" })).toHaveCount(1);
});

test("a Chapter 5 EURUSD level draws a line rather than a wall of dojis", async ({
  page,
}) => {
  // Issue #58's fix, checked where a player would see it. The canvas cannot be read from here,
  // so this asserts the page still renders and the level still works — the visual check is in
  // the milestone's browser pass, and the set membership is pinned in integrity.test.ts.
  await seed(page, { "1-B": cleared, "2-B": cleared, "3-B": cleared, "4-B": cleared });
  await page.goto("/level/5-1");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("canvas").first()).toBeVisible();
  await expect(page.getByText(/could not load/i)).toHaveCount(0);
});

test("8.B grades its first stage on an unlabelled chart", async ({ page }) => {
  // The transfer check the boss exists for: no comparison chart, because every other market
  // in the spine is taught in this chapter, so the character has to be read absolutely.
  await openUnlocked(page, "8-B");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(/An unfamiliar market/).first()).toBeVisible();

  // The first option is the measured answer: two and a half percent, the middle of the six.
  await page.getByRole("radio").nth(0).check();
  await page.getByRole("button", { name: /commit answer/i }).click();
  await expect(page.getByText(/✓ correct/).first()).toBeVisible();
  await expect(page.getByText(/2\.32% of price/)).toBeVisible();

  // A composite does not auto-advance — the player picks the next stage, which is existing
  // behaviour across every boss since Chapter 2. Following it rather than asserting otherwise.
  await page.getByRole("button", { name: /Now the rule/i }).click();
  await expect(page.getByText(/which of the four rules/i)).toBeVisible();
});

test("clearing 8.B is what opens Chapter 9", async ({ page }) => {
  // Asserted in both directions. Seeded rather than played, following chapter6.spec.ts: this
  // boss ends in a replay-trade stage needing a stop drawn on a canvas, which Playwright
  // cannot do meaningfully. That the boss is *winnable* is proven in guards.test.ts, which
  // scores its reference attempt at three stars and checks every component of the trade plan
  // individually — the check added in M7c after 4.B shipped failing its own room check.
  const throughSeven: Record<string, typeof cleared> = {};
  for (const boss of BOSSES) throughSeven[boss] = cleared;
  for (const id of ORDER.slice(0, -1)) throughSeven[id] = cleared;

  await seed(page, throughSeven);
  await page.goto("/");
  await expect(page.locator('a[href="/chapter/8"]')).toBeVisible();
  await expect(page.locator('a[href="/chapter/9"]')).toHaveCount(0);

  await seed(page, {
    ...throughSeven,
    "8-B": { stars: 2, bestScore: 0.8, attempts: 1, completedAt: null },
  });
  await page.goto("/");
  await expect(page.locator('a[href="/chapter/9"]')).toBeVisible();
  await expect(page.locator('a[href="/chapter/10"]')).toHaveCount(0);
});
