import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// The app imports through the "@/" alias from tsconfig. Vitest resolves modules
// itself, so it needs the same mapping or any runtime (non-type) import through
// the alias fails to resolve.
const alias = { "@": fileURLToPath(new URL(".", import.meta.url)) };

// Two projects rather than one: the bulk of this codebase's correctness risk is
// pure logic (graders, indicators, geometry, backtester), and that runs far
// faster without a DOM. Only component tests pay for happy-dom.
export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "lib",
          environment: "node",
          include: ["lib/**/*.test.ts", "scripts/**/*.test.ts"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "components",
          environment: "happy-dom",
          // Both extensions: a test sitting next to its code should run without
          // anyone having to remember which project claims which suffix.
          include: [
            "components/**/*.test.ts",
            "components/**/*.test.tsx",
            "app/**/*.test.ts",
            "app/**/*.test.tsx",
          ],
        },
      },
    ],
  },
});
