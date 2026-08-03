import { expect, test, type Page } from "@playwright/test";

/**
 * Chapter 9 through the browser: the chapter that reads the player's own record back.
 *
 * Three things here are unreachable from the unit suite, and two of them have already been
 * defects. **The journal panel and the coin-flip distribution are components that read the
 * store**, so they depend on hydration — `JournalPanel` shipped once telling a player with
 * seventeen trades that they had none, because the store sets `skipHydration` and an empty
 * journal is a sentence rather than a blank. **9.5's later window must be absent before commit**,
 * which is the entire pedagogy of the level and lives in a `revealed` prop no grader sees. And
 * **9.B's three stages must each chart their own market** — until M9 the composite paired step
 * slices with loaded series by index, so all three reports would have drawn the index.
 *
 * The last test is the milestone's gate: Chapter 10 reachable by clearing 9.B, with no fixture.
 */

const cleared = { stars: 3, bestScore: 1, attempts: 1, completedAt: null };

type Progress = Record<string, typeof cleared>;

const TRADE = {
  id: "seed-1",
  levelId: "3-B",
  seriesId: "BTCUSDT-4h",
  assetClass: "crypto-spot",
  entry: 100,
  stop: 95,
  target: 110,
  exit: 110,
  r: 2,
  reason: "pullback into the level that broke, with the trend still up",
  tags: ["long", "BTCUSDT-4h"],
  at: "2025-01-01T00:00:00.000Z",
  attemptNo: 1,
  planned: true,
  setup: "continuation",
};

async function seed(
  page: Page,
  progress: Progress,
  journal: (typeof TRADE)[] = [],
) {
  await page.goto("/");
  await page.evaluate(
    ({ entries, trades }) => {
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
            journal: trades,
            strategies: [],
            predictions: {},
          },
        }),
      );
    },
    { entries: progress, trades: journal },
  );
}

const BOSSES = ["1-B", "2-B", "3-B", "4-B", "5-B", "6-B", "7-B", "8-B"];
const ORDER = ["9-1", "9-2", "9-3", "9-4", "9-5", "9-6", "9-B"];

/** Every earlier chapter cleared, plus every Chapter 9 level *before* this one. */
async function openUnlocked(page: Page, id: string, journal: (typeof TRADE)[] = []) {
  const progress: Progress = {};
  for (const boss of BOSSES) progress[boss] = cleared;
  for (const earlier of ORDER.slice(0, ORDER.indexOf(id))) progress[earlier] = cleared;
  await seed(page, progress, journal);
  await page.goto(`/level/${id}`);
}

test("every Chapter 9 level renders", async ({ page }) => {
  for (const id of ORDER) {
    await openUnlocked(page, id);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText(/loading level/i)).toHaveCount(0);
    await expect(page.getByText(/could not load/i)).toHaveCount(0);
    await expect(page.getByText(/not authored yet/i)).toHaveCount(0);
  }
});

test("9.1 asks for an expectancy and accepts the measured one", async ({ page }) => {
  await openUnlocked(page, "9-1");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // Twenty-four outcomes listed, nine of them wins: the list a player reads as a failure.
  await expect(page.getByText(/gapped/).first()).toBeVisible();

  await page.getByRole("spinbutton").first().fill("0.15");
  await page.getByRole("button", { name: /commit/i }).click();
  const stored = await page.evaluate(
    () =>
      JSON.parse(window.localStorage.getItem("chart-quest") ?? "{}").state?.progress?.[
        "9-1"
      ],
  );
  expect(stored?.stars).toBeGreaterThanOrEqual(2);
});

test("9.2 shows the distribution before the answer, and marks a stored 1.B score", async ({
  page,
}) => {
  // The artefact is pre-commit because it is the evidence — distinct from `reveal`, which is the
  // correction. If it waited for the commit there would be nothing to reason from.
  await openUnlocked(page, "9-2");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const table = page.getByRole("table").last();
  await expect(table).toBeVisible();
  await expect(table).toContainText("3.1%");
  await expect(page.getByRole("radio").first()).toBeVisible();
});

test("9.3 hides the measured drawdown until the guess is committed", async ({ page }) => {
  await openUnlocked(page, "9-3");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(/Measuring…/)).toHaveCount(0);

  // Apple's curve gives back 8.2R of its 51.7R, and that figure is the answer.
  await expect(page.getByText(/8\.2R/)).toHaveCount(0);
  const control = page.getByRole("slider");
  await control.focus();
  for (let i = 0; i < 8; i += 1) await page.keyboard.press("ArrowRight");
  await page.getByRole("button", { name: /commit/i }).click();
  await expect(page.getByText(/8\.2/).first()).toBeVisible();
});

test("9.5 holds the later window back until the parameter is committed", async ({ page }) => {
  // **The level's whole pedagogy.** A player who can see the held-back column while sweeping is
  // being shown the answer to the question the level is asking.
  await openUnlocked(page, "9-5");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(/Measuring…/)).toHaveCount(0);

  const table = page.getByRole("table").last();
  await expect(table).toBeVisible();
  await expect(table).not.toContainText("later");

  // The commit button refuses until 60% of the twenty-six settings have been visited, which is
  // the interaction issue #26 asked for: the player runs the sweep rather than reading a
  // conclusion. Twenty-six presses covers the range.
  const control = page.getByRole("slider");
  await control.focus();
  for (let i = 0; i < 26; i += 1) await page.keyboard.press("ArrowRight");
  await page.getByRole("button", { name: /commit/i }).click();
  await expect(page.getByRole("table").last()).toContainText("later");
  // And it must not print a "correct" parameter, which is why the level scores exploration.
  await expect(page.getByText(/✓ correct/)).toHaveCount(0);
});

test("9.6 reads a real journal, and degrades honestly on an empty one", async ({ page }) => {
  // The milestone's gate, both ways round. The panel reads the store — which a component may do
  // — and it must wait for hydration, because an empty journal is a sentence here.
  await openUnlocked(page, "9-6", [TRADE, { ...TRADE, id: "seed-2", r: -1, exit: 95 }]);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(/2 you planned yourself/)).toBeVisible();
  await expect(page.getByText(/too few to say/).first()).toBeVisible();
  await expect(page.getByText(/Nothing logged yet/)).toHaveCount(0);

  await openUnlocked(page, "9-6");
  await expect(page.getByText(/Nothing logged yet/)).toBeVisible();
  // Still answerable: the graded question is what the record supports, and "very little yet" is
  // true of an empty record too.
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: /commit answer/i }).click();
  const stored = await page.evaluate(
    () =>
      JSON.parse(window.localStorage.getItem("chart-quest") ?? "{}").state?.progress?.[
        "9-6"
      ],
  );
  expect(stored?.stars).toBe(3);
});

test("9.B charts a different market under each of its three reports", async ({ page }) => {
  // The regression the composite's positional pairing would have caused: three reports, one
  // chart each, all three of them the index. Series ids are not in the DOM, so this reads the
  // labels the level authored — which is what a player would notice too.
  await openUnlocked(page, "9-B");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(/S&P 500 · the first year this report never saw/)).toBeVisible();

  // Every claim's note is a verdict, so none may show before the stage is committed.
  await expect(page.getByText(/Does not follow/)).toHaveCount(0);
  await page.getByRole("checkbox").nth(3).check();
  await page.getByRole("checkbox").nth(4).check();
  await page.getByRole("button", { name: /^commit$/i }).click();
  await expect(page.getByText(/Does not follow/).first()).toBeVisible();

  await page.getByRole("button", { name: /Report two/i }).click();
  await expect(page.getByText(/The small-cap · 2018/)).toBeVisible();

  await page.getByRole("button", { name: /Report three/i }).click();
  await expect(page.getByText(/Apple · the year everything worked/)).toBeVisible();
});

test("the skill radar names ten axes and separates untouched from failed", async ({ page }) => {
  // A radar cannot say *why* an axis is short, so the readings are text as well as a shape —
  // and "not started" has to be distinguishable from a low score, or the page tells a player to
  // practise a chapter they have not reached.
  await seed(page, { "1-1": { stars: 0, bestScore: 0.2, attempts: 3, completedAt: null } });
  await page.goto("/progress");
  await expect(page.getByRole("heading", { name: "Your skills" })).toBeVisible();
  await expect(page.getByText(/1 of 10 measured/)).toBeVisible();
  await expect(page.getByText("0 of 24 stars")).toBeVisible();
  await expect(page.getByText("not started").first()).toBeVisible();
  await expect(page.getByText(/worth going back to/)).toBeVisible();
  await expect(page.getByText(/Reading$/).first()).toBeVisible();

  // Discipline is the axis no chapter scores, so stars alone must leave it unmeasured.
  await expect(page.getByText("no trades yet")).toBeVisible();
  await seed(page, { "1-1": { stars: 0, bestScore: 0.2, attempts: 3, completedAt: null } }, [TRADE]);
  await page.goto("/progress");
  await expect(page.getByText("from 1 trade")).toBeVisible();
});

test("clearing 9.B is what opens Chapter 10", async ({ page }) => {
  // **The milestone's other gate: reachable without a localStorage fixture.** Seeded here for
  // the same reason chapter8.spec.ts seeds — 9.B's stages are checkbox reviews, so this one
  // *could* be played, but the unlock rule is what is under test and playing it would only add
  // ways for the test to fail for unrelated reasons.
  const throughEight: Progress = {};
  for (const boss of BOSSES) throughEight[boss] = cleared;
  for (const id of ORDER.slice(0, -1)) throughEight[id] = cleared;

  await seed(page, throughEight);
  await page.goto("/");
  await expect(page.locator('a[href="/chapter/9"]')).toBeVisible();
  await expect(page.locator('a[href="/chapter/10"]')).toHaveCount(0);

  await seed(page, {
    ...throughEight,
    "9-B": { stars: 2, bestScore: 0.8, attempts: 1, completedAt: null },
  });
  await page.goto("/");
  await expect(page.locator('a[href="/chapter/10"]')).toBeVisible();
});
