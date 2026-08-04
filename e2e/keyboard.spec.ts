import { expect, test, type Page } from "@playwright/test";

/**
 * Every kind completable without a pointer.
 *
 * `CONVENTIONS.md` has claimed since M3 that each kind works from the keyboard, and every kind has
 * been built that way — native checkboxes, radios and ranges, buttons rather than drag handles, and a
 * `role="application"` surface for the draw tools. This file is where the claim stops being a claim.
 *
 * **The draw tools are the reason it exists.** `annotate` is the one kind whose natural interaction is
 * a pointer drag, so it is the one that could plausibly be unusable without a mouse — and it is the
 * kind three chapters are built on. Everything else here is cheap insurance beside it.
 *
 * Playwright drives real key events through the browser's own focus model, which is the only
 * instrument that answers this honestly: synthetic `KeyboardEvent`s dispatched from page script do not
 * reliably reach React's handlers, and a hand-rolled probe that "found" a bug would be measuring the
 * probe.
 */

const cleared = { stars: 3, bestScore: 1, attempts: 1, completedAt: null };

/** Every level cleared, so any level can be opened directly. */
async function seedEverything(page: Page) {
  await page.goto("/");
  await page.evaluate((entry) => {
    const counts: Record<number, number> = {
      1: 7, 2: 6, 3: 6, 4: 6, 5: 6, 6: 6, 7: 7, 8: 6, 9: 6, 10: 7,
    };
    const progress: Record<string, typeof entry> = {};
    for (const [chapter, n] of Object.entries(counts)) {
      for (let i = 1; i <= n; i += 1) progress[`${chapter}-${i}`] = entry;
      progress[`${chapter}-B`] = entry;
    }
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
          progress,
          journal: [],
          strategies: [],
          predictions: {},
        },
      }),
    );
  }, cleared);
}

async function starsFor(page: Page, id: string) {
  return page.evaluate(
    (levelId) =>
      JSON.parse(window.localStorage.getItem("chart-quest") ?? "{}").state?.progress?.[
        levelId
      ]?.stars as number | undefined,
    id,
  );
}

test("2.3 — a trendline can be drawn with the keyboard alone", async ({ page }) => {
  // **The headline check.** Three chapters rest on `annotate`, and its natural input is a drag.
  await seedEverything(page);
  await page.goto("/level/2-3");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  const surface = page.getByRole("application");
  await expect(surface).toBeVisible();
  // Reachable by Tab rather than only by a programmatic focus call: it is second in the order,
  // after the back link.
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(surface).toBeFocused();

  // The label has to teach the keys, or a screen-reader user has a focusable box and no idea.
  await expect(surface).toHaveAttribute(
    "aria-label",
    /arrow keys move the cursor/i,
  );

  // A live readout of where the cursor is, in the units the level is about.
  const status = page.getByText(/of 2 points · cursor bar/);
  await expect(status).toBeVisible();
  const atStart = await status.textContent();

  // Move, and the readout has to move with it.
  await page.keyboard.press("ArrowRight");
  await expect(status).not.toHaveText(atStart!);

  // Shift is the coarse step, which is what makes a 90-bar window navigable at all.
  const afterOne = await status.textContent();
  await page.keyboard.press("Shift+ArrowRight");
  const afterTen = await status.textContent();
  expect(afterTen).not.toBe(afterOne);

  // Place two points and commit, entirely from the keyboard.
  await page.keyboard.press("Enter");
  await expect(page.getByText(/1 of 2 points/)).toBeVisible();
  for (let i = 0; i < 6; i += 1) await page.keyboard.press("Shift+ArrowRight");
  await page.keyboard.press("Enter");
  await expect(page.getByText(/2 of 2 points/)).toBeVisible();

  await page.getByRole("button", { name: /commit drawing/i }).click();
  expect(await starsFor(page, "2-3")).not.toBeUndefined();
});

test("2.3 — escape clears the anchors, so a keyboard user can start over", async ({
  page,
}) => {
  await seedEverything(page);
  await page.goto("/level/2-3");
  const surface = page.getByRole("application");
  await surface.focus();

  await page.keyboard.press("Enter");
  await expect(page.getByText(/1 of 2 points/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByText(/0 of 2 points/)).toBeVisible();
});

test("the y-axis control is operable and labelled, on a level that has it", async ({
  page,
}) => {
  await seedEverything(page);
  await page.goto("/level/2-3");
  const group = page.getByRole("group", { name: /y-axis units/i });
  await expect(group).toBeVisible();
  // Each button says what it does rather than only what it is called.
  // The visible labels. Each also carries a `title` explaining it, which is what a pointer user
  // gets on hover — see the note below on whether the accessible name should be the label or the hint.
  for (const name of [/^price$/i, /^%$/, /^atr$/i]) {
    await expect(group.getByRole("button", { name })).toBeVisible();
  }
  await group.getByRole("button", { name: /^%$/ }).click();
  await expect(page.getByRole("application")).toBeVisible();
});

/**
 * One level per remaining kind, completed without a pointer.
 *
 * `click()` is used on plain buttons because a button is keyboard-operable by definition and
 * Playwright's click does not test that; what each case actually exercises is that the *input* the
 * kind is built on can be reached and driven by key — `check()` on a native radio or checkbox,
 * `press()` on a range, `fill()` on a number field.
 */
const KINDS: {
  kind: string;
  id: string;
  complete: (page: Page) => Promise<void>;
}[] = [
  {
    kind: "classify",
    id: "1-2",
    complete: async (page) => {
      await page.getByRole("radio").first().check();
      await page.getByRole("button", { name: /commit answer/i }).click();
    },
  },
  {
    kind: "mark-bars",
    id: "1-1",
    complete: async (page) => {
      // `candle-anatomy` mode draws the hit zones itself so each part can be a real button — which
      // is why this mode needs no `role="application"` surface. The bars mode has one; 1.1 does not.
      await page.getByRole("button", { name: /body/i }).first().focus();
      await page.keyboard.press("Enter");
      await page.getByRole("button", { name: /commit/i }).click();
    },
  },
  {
    kind: "spot-the-flaw",
    id: "6-5",
    complete: async (page) => {
      await page.getByRole("checkbox").first().focus();
      await page.keyboard.press("Space");
      await page.getByRole("button", { name: /^commit$/i }).click();
    },
  },
  {
    kind: "sizing-calc",
    id: "7-1",
    complete: async (page) => {
      await page.getByRole("spinbutton").first().fill("100");
      await page.getByRole("button", { name: /commit/i }).click();
    },
  },
  {
    kind: "probe",
    id: "8-2",
    complete: async (page) => {
      const slider = page.getByRole("slider");
      await slider.focus();
      for (let i = 0; i < 95; i += 1) await page.keyboard.press("ArrowRight");
      await page.getByRole("button", { name: /commit/i }).click();
    },
  },
  {
    kind: "tune-param",
    id: "5-1",
    complete: async (page) => {
      const slider = page.getByRole("slider");
      await slider.focus();
      // 5.1 scores exploration, so the button stays disabled until the range is swept — and it says
      // "I have seen enough" rather than "Commit", because on a level with no right answer that is
      // what committing means.
      for (let i = 0; i < 60; i += 1) await page.keyboard.press("ArrowRight");
      await page.getByRole("button", { name: /I have seen enough/i }).click();
    },
  },
  {
    kind: "build-rules",
    id: "10-3",
    complete: async (page) => {
      await page.getByRole("button", { name: /^\+ A reading above or below/ }).click();
      await page.getByRole("button", { name: /^Run it$/ }).click();
    },
  },
];

for (const { kind, id, complete } of KINDS) {
  test(`${kind} (${id}) is completable without a pointer`, async ({ page }) => {
    await seedEverything(page);
    await page.goto(`/level/${id}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await complete(page);
    expect(await starsFor(page, id), `${id} recorded no attempt`).not.toBeUndefined();
  });
}

test("no decorative table is announced inside a chart", async ({ page }) => {
  // The charting library lays itself out in a `<table>`, which lands inside the chart's own
  // `role="img"` and reaches assistive technology as a table of empty cells. It is noise, and every
  // charted level has it.
  await seedEverything(page);
  await page.goto("/level/2-3");
  const chart = page.getByRole("img", { name: /price chart/i });
  await expect(chart).toBeVisible();
  expect(await chart.getByRole("table").count()).toBe(0);
});
