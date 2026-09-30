import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

const sharedRules = {
  "no-console": "error",
  "no-var": "error",
  "prefer-const": "error",
  eqeqeq: ["error", "always"],
};

const unusedVarsOptions = { args: "all", caughtErrors: "all", argsIgnorePattern: "^_" };

export default defineConfig([
  globalIgnores(["**/dist/", "**/coverage/", ".claude/", ".impeccable/"]),
  {
    files: ["**/*.js"],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
    rules: { ...sharedRules, "no-unused-vars": ["error", unusedVarsOptions] },
  },
  {
    files: ["**/*.ts"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    rules: {
      ...sharedRules,
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["error", unusedVarsOptions],
    },
  },
  prettier,
]);
