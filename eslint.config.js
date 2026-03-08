import js from "@eslint/js";
import sonarjs from "eslint-plugin-sonarjs";
import globals from "globals";

export default [
  {
    ignores: ["example/", "node_modules/", "dist/"],
  },
  { ...js.configs.recommended, files: ["**/*.{js,jsx}"] },
  { ...sonarjs.configs.recommended, files: ["**/*.{js,jsx}"] },
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "sonarjs/cognitive-complexity": ["warn", 15],
      "no-restricted-syntax": [
        "error",
        {
          selector: "ChainExpression",
          message: "Optional chaining (?.) is banned. Use explicit null checks or logical AND (&&) instead.",
        },
      ],
    },
  },
  {
    files: ["**/*.jsx"],
    rules: {
      // Components referenced in JSX aren't detected as used without eslint-plugin-react
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_|^[A-Z]" }],
    },
  },
];
