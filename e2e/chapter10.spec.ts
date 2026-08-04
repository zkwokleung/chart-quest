import { expect, test, type Page } from "@playwright/test";

/**
 * Chapter 10 through the browser: the composer, the holdback and the end of the game.
 *
 * Four things here are unreachable from the unit suite. **The palette is progress-gated**, so its
 * correctness is a property of two things at once — the store and the level — exactly like the y-axis
 * unlock that needed a browser test in M8. **The holdback is fetched**, through the loader that has been
 * unimported since M2, so "the run has numbers in it" spans Suspense, a network request and a parse.
 * **The playbook is a Blob download**, which has no meaning outside a browser. And **clearing 10.B
 * completes the game**, which is the one state no other test can reach.
 */

const cleared = { stars: 3, bestScore: 1, attempts: 1, completedAt: null };

type Progress = Record<string, typeof cleared>;

async function seed(page: Page, progress: Progress, strategies: unknown[] = []) {
  await page.goto("/");
  await page.evaluate(
    ({ entries, saved }) => {
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
            strategies: saved,
            predictions: {},
          },
        }),
      );
    },
    { entries: progress, saved: strategies },
  );
}

const BOSSES = ["1-B", "2-B", "3-B", "4-B", "5-B", "6-B", "7-B", "8-B", "9-B"];
const ORDER = ["10-1", "10-2", "10-3", "10-4", "10-5", "10-6", "10-7", "10-B"];

/** The rule the chapter is built on, in the shape the store holds it. */
const DIP = [
  { kind: "compare", left: { kind: "close" }, op: ">", right: { kind: "sma", period: 200 } },
  { kind: "compare", left: { kind: "rsi", period: 14 }, op: "<", right: 40 },
];

const SAVED_DIP = [
  {
    id: "saved-1",
    name: "Dip in an uptrend",
    blocks: DIP,
    lastResult: null,
    scope: ["SPY-1d", "GC-1d", "BTCUSDT-1d"],
    variants: 4,
    savedAt: "2026-08-01T00:00:00.000Z",
  },
];

async function openUnlocked(page: Page, id: string, strategies: unknown[] = []) {
  const progress: Progress = {};
  for (const boss of BOSSES) progress[boss] = cleared;
  for (const earlier of ORDER.slice(0, ORDER.indexOf(id))) progress[earlier] = cleared;
  await seed(page, progress, strategies);
  await page.goto(`/level/${id}`);
}

test("every Chapter 10 level renders", async ({ page }) => {
  for (const id of ORDER) {
    await openUnlocked(page, id);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText(/loading level/i)).toHaveCount(0);
    await expect(page.getByText(/could not load/i)).toHaveCount(0);
    await expect(page.getByText(/not authored yet/i)).toHaveCount(0);
  }
});

test("the palette grows with progress rather than showing everything", async ({ page }) => {
  // **The assertion that needs two pages at once.** The blocks a player can compose with are a
  // property of the store, not of the level, and #28's whole framing is that the palette is their
  // progress made concrete.
  await seed(page, { "1-B": cleared, "2-B": cleared, "3-1": cleared, "9-B": cleared });
  await page.goto("/strategy");
  await expect(page.getByRole("heading", { name: "Strategy" })).toBeVisible();
  // Chapter 9 reached, so everything is unlocked and nothing is padlocked.
  await expect(page.getByRole("button", { name: /^\+ Structure/ })).toBeEnabled();
  await expect(page.getByRole("button", { name: /^🔒/ })).toHaveCount(0);

  // A player who has only reached Chapter 3 has two, and can see what the others cost.
  await seed(page, { "1-B": cleared, "2-B": cleared, "3-1": cleared });
  await page.goto("/strategy");
  await expect(page.getByRole("button", { name: /^\+ Structure/ })).toBeEnabled();
  await expect(page.getByRole("button", { name: /^\+ At a level/ })).toBeEnabled();
  const locked = page.getByRole("button", { name: /^🔒/ });
  await expect.poll(async () => locked.count()).toBe(3);
  await expect(locked.first()).toBeDisabled();
  // And it names the chapter that unlocks it rather than only refusing.
  await expect(page.getByText("Ch 5").first()).toBeVisible();
});

test("a beginner is told what to play rather than shown an empty workbench", async ({ page }) => {
  await seed(page, { "1-1": cleared });
  await page.goto("/strategy");
  await expect(page.getByText(/Nothing to build with yet/)).toBeVisible();
  await expect(page.getByText(/the palette grows with you/)).toBeVisible();
});

test("10.3 runs a composed strategy and grades it against the baseline", async ({ page }) => {
  await openUnlocked(page, "10-3");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // Compose from the palette, which is what the level is for.
  await page.getByRole("button", { name: /^\+ A reading above or below/ }).click();
  await expect(page.getByText(/the close is above the 200-bar average/)).toBeVisible();

  await page.getByRole("button", { name: /^Run it$/ }).click();

  // The run has to produce a real per-market table, with the trade count first.
  const table = page.getByRole("table").last();
  await expect(table).toBeVisible();
  await expect(table).toContainText("SPY-1d");
  await expect(table).toContainText("GC-1d");
  // The comparison column is the level's whole point.
  await expect(table).toContainText("doing nothing");
  await expect(page.getByText(/no entry rule at all/)).toBeVisible();

  const stored = await page.evaluate(
    () =>
      JSON.parse(window.localStorage.getItem("chart-quest") ?? "{}").state?.progress?.[
        "10-3"
      ],
  );
  expect(stored?.attempts).toBe(1);
});

test("the composer refuses to run an empty rule", async ({ page }) => {
  await openUnlocked(page, "10-3");
  await expect(page.getByRole("button", { name: /Add a condition first/ })).toBeDisabled();
});

test("10.6 reads the holdback, and says what it cannot establish", async ({ page }) => {
  // The first and only use of `load-oos.ts`, so this spans the fetch, the parse and the run.
  await openUnlocked(page, "10-6", SAVED_DIP);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(/on data it has never seen/)).toBeVisible();

  const table = page.getByRole("table").last();
  await expect(table).toBeVisible();
  await expect(table).toContainText("SPY-1d-oos");
  // Nine trades on the index — measured, and the reason the level asks what it asks.
  await expect(page.getByText(/too few to say/).first()).toBeVisible();
  // Said twice on purpose — once by the verdict and once by the table's own note — so `.first()`
  // rather than a stricter locator. Both are the level's voice.
  await expect(page.getByText(/cannot rule one in/).first()).toBeVisible();
  await expect(page.getByText(/Too little to say\. 3 of 3 markets/)).toBeVisible();

  // And the graded question is answerable, because its answer is the same for everybody.
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: /commit answer/i }).click();
  const stored = await page.evaluate(
    () =>
      JSON.parse(window.localStorage.getItem("chart-quest") ?? "{}").state?.progress?.[
        "10-6"
      ],
  );
  expect(stored?.stars).toBe(3);
});

test("10.6 degrades honestly when nothing has been saved", async ({ page }) => {
  await openUnlocked(page, "10-6");
  await expect(page.getByText(/have not saved a strategy yet/)).toBeVisible();
  // Still winnable — the answer never depended on the strategy.
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: /commit answer/i }).click();
  const stored = await page.evaluate(
    () =>
      JSON.parse(window.localStorage.getItem("chart-quest") ?? "{}").state?.progress?.[
        "10-6"
      ],
  );
  expect(stored?.stars).toBe(3);
});

test("10.B prints a playbook that carries its sample sizes", async ({ page }) => {
  await openUnlocked(page, "10-B", SAVED_DIP);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  await page.getByRole("button", { name: /^\+ A reading above or below/ }).click();
  await page.getByRole("button", { name: /^Run it$/ }).click();

  await expect(page.getByRole("heading", { name: "Your playbook" })).toBeVisible();
  const document_ = page.locator(".playbook-document");
  await expect(document_).toContainText("## The rule");
  await expect(document_).toContainText("the close is above the 200-bar average");
  // The rule this document exists to keep.
  await expect(document_).toContainText("| Market | Trades |");
  await expect(document_).toContainText("## Known failure modes");
  await expect(document_).toContainText("Expect to be");
  await expect(document_).toContainText("Review cadence");
  await expect(document_).toContainText("not financial advice");

  // And it downloads without a server.
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /Download as Markdown/ }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.md$/);
});

test("clearing 10.B is the end of the game", async ({ page }) => {
  // The one state no other test can reach: every chapter cleared, nothing left locked.
  const everything: Progress = {};
  for (const boss of BOSSES) everything[boss] = cleared;
  for (const id of ORDER) everything[id] = cleared;

  await seed(page, everything);
  await page.goto("/");
  for (let chapter = 1; chapter <= 10; chapter += 1) {
    await expect(page.locator(`a[href="/chapter/${chapter}"]`)).toBeVisible();
  }
  await page.goto("/chapter/10");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(/not authored yet/i)).toHaveCount(0);
});
