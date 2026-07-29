import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    // Graders and level content must be pure and deterministic. The authoring
    // guards replay a level's own target through its grader and expect three
    // stars every time — a grader that reads the clock or rolls a die makes that
    // check meaningless, and makes a player's score unreproducible.
    files: [
      "lib/levels/grade.ts",
      "lib/levels/diagnose.ts",
      "lib/levels/mark.ts",
      "lib/levels/kinds/**/grade.ts",
      "lib/levels/content/**/*.ts",
    ],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "Date", message: "Graders and level content must be deterministic." },
        { name: "window", message: "Graders must not touch the DOM." },
        { name: "document", message: "Graders must not touch the DOM." },
        { name: "localStorage", message: "Graders must not read the store." },
      ],
      "no-restricted-properties": [
        "error",
        {
          object: "Math",
          property: "random",
          message: "Graders and level content must be deterministic.",
        },
        {
          object: "Date",
          property: "now",
          message: "Graders and level content must be deterministic.",
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "NewExpression[callee.name='Date']",
          message: "Graders and level content must be deterministic.",
        },
      ],
    },
  },

  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
