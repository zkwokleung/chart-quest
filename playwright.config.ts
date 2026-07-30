import { defineConfig, devices } from "@playwright/test";

/**
 * Not 3000, deliberately.
 *
 * `reuseExistingServer` means Playwright tests whatever is already listening, and
 * on the default port that is routinely another project. When it happened here,
 * 14 of 15 specs failed against an unrelated site — which is the *good* outcome;
 * the bad one is a suite that passes without ever having loaded Chart Quest. A
 * port nothing else claims makes the collision unlikely, and `globalSetup` makes
 * it loud rather than baffling if it recurs.
 */
const PORT = Number(process.env.CQ_E2E_PORT ?? 3421);

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  // Tests run against the production build, not `next dev`. Persistence and
  // hydration behave differently between the two, and production is what
  // players get.
  webServer: {
    command: `npm run build && npm run start -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
