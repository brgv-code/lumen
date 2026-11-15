import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config({
  files: ["packages/core/src/**/*.ts", "apps/web/src/**/*.{ts,tsx}", "apps/extension/src/**/*.{ts,tsx}"],
  extends: [tseslint.configs.base],
  plugins: { "react-hooks": reactHooks },
  languageOptions: {
    parserOptions: {
      // Listed by hand: the worker has its own tsconfig, which the project service would not find.
      project: [
        "packages/core/tsconfig.json",
        "apps/web/tsconfig.json",
        "apps/web/tsconfig.worker.json",
        "apps/extension/tsconfig.json",
      ],
      tsconfigRootDir: import.meta.dirname,
    },
  },
  rules: {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/consistent-type-assertions": ["error", { assertionStyle: "never" }],
    "@typescript-eslint/switch-exhaustiveness-check": [
      "error",
      { considerDefaultExhaustiveForUnions: true, requireDefaultForNonUnion: false },
    ],
    "react-hooks/exhaustive-deps": "error",
  },
});
