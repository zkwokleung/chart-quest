import { expect, test } from "@playwright/test";

test("landing page renders the name and tagline", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Chart Quest",
  );
  await expect(page.getByText(/one level at a time/i)).toBeVisible();
});
