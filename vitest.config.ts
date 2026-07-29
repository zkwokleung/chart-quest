import { defineConfig } from "vitest/config";

// Two projects rather than one: the bulk of this codebase's correctness risk is
// pure logic (graders, indicators, geometry, backtester), and that runs far
// faster without a DOM. Only component tests pay for happy-dom.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "lib",
          environment: "node",
          include: ["lib/**/*.test.ts", "scripts/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "components",
          environment: "happy-dom",
          include: ["components/**/*.test.tsx", "app/**/*.test.tsx"],
        },
      },
    ],
  },
});
