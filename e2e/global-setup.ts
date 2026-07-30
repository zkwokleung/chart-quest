import { request } from "@playwright/test";

/**
 * Fails fast if the server under test is not Chart Quest.
 *
 * `reuseExistingServer` will attach to whatever holds the port. That produced a
 * run where 14 of 15 specs failed against an unrelated site, and the failures said
 * "strict mode violation: resolved to 3 elements" rather than "wrong app" — a
 * confusing half-hour instead of one clear line. The reverse case is worse: a
 * suite green against something that was never Chart Quest.
 */
export default async function globalSetup(): Promise<void> {
  const port = process.env.CQ_E2E_PORT ?? "3421";
  const baseURL = `http://localhost:${port}`;
  const context = await request.newContext({ baseURL });
  try {
    const response = await context.get("/");
    const body = await response.text();
    if (!body.includes("Chart Quest")) {
      throw new Error(
        `The server at ${baseURL} is not Chart Quest — its landing page does not ` +
          `mention the name. Something else is probably holding the port; set ` +
          `CQ_E2E_PORT to a free one.`,
      );
    }
  } finally {
    await context.dispose();
  }
}
