import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import prettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores([
    "**/node_modules/**",
    "**/.next/**",
    "**/.next-e2e/**",
    "**/dist/**",
    "**/coverage/**",
    ".idea/**",
    "frontend/next-env.d.ts",
  ]),
  js.configs.recommended,
  {
    files: ["frontend/**/*.{ts,tsx,js,mjs}"],
    extends: nextVitals,
    settings: { next: { rootDir: "frontend/" } },
  },
  {
    files: ["**/*.{js,cjs,mjs,ts,tsx}"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    files: ["**/*.{ts,tsx}"],
    extends: tseslint.configs.recommended,
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  prettier,
]);
