import { fixupPluginRules } from "@eslint/compat";
import js from "@eslint/js";
import expoConfig from "eslint-config-expo/flat.js";
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

const tsRules = {
  ...sharedRules,
  "no-unused-vars": "off",
  "@typescript-eslint/no-unused-vars": ["error", unusedVarsOptions],
};

// eslint-plugin-import 2.x can't load its TypeScript resolver on ESLint 10, so every rule
// that resolves import paths is off; tsc reports unresolved imports instead.
const resolverImportRules = Object.fromEntries(
  [
    "default",
    "export",
    "named",
    "namespace",
    "no-duplicates",
    "no-named-as-default",
    "no-named-as-default-member",
    "no-unresolved",
  ].map((rule) => [`import/${rule}`, "off"]),
);

// eslint-config-expo's React and import plugins still call context methods ESLint 10 removed;
// fixupPluginRules restores them. Only those two are wrapped: a wrapped @typescript-eslint would
// clash with the copy the TypeScript block below registers.
const pluginsNeedingFixup = new Set(["import", "react"]);
const expoConfigForEslint10 = expoConfig.map((config) =>
  config.plugins
    ? {
        ...config,
        plugins: Object.fromEntries(
          Object.entries(config.plugins).map(([name, plugin]) => [
            name,
            pluginsNeedingFixup.has(name) ? fixupPluginRules(plugin) : plugin,
          ]),
        ),
      }
    : config,
);

export default defineConfig([
  globalIgnores([
    "**/dist/",
    "**/coverage/",
    "**/.expo/",
    "**/expo-env.d.ts",
    ".claude/",
    ".impeccable/",
  ]),
  {
    files: ["**/*.js"],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
    rules: { ...sharedRules, "no-unused-vars": ["error", unusedVarsOptions] },
  },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    rules: tsRules,
  },
  {
    // The repo's rules are re-applied after Expo's, which are looser (e.g. eqeqeq "smart").
    files: ["mobile/**/*.{ts,tsx}"],
    extends: [expoConfigForEslint10],
    rules: {
      ...tsRules,
      ...resolverImportRules,
      "no-duplicate-imports": ["error", { allowSeparateTypeImports: true }],
    },
  },
  prettier,
]);
