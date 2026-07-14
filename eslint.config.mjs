// @ts-check

import zotero from "@zotero-plugin/eslint-config";

export default zotero({
  overrides: [
    {
      files: ["**/*.ts"],
      rules: {
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-unused-vars": [
          "error",
          {
            argsIgnorePattern: "^_",
            caughtErrors: "all",
            caughtErrorsIgnorePattern: "^_",
            varsIgnorePattern: "^_",
          },
        ],
      },
    },
    {
      files: ["addon/**/*.js"],
      languageOptions: {
        globals: {
          document: "readonly",
          fetch: "readonly",
          URLSearchParams: "readonly",
          window: "readonly",
          Zotero: "readonly",
        },
      },
      rules: {
        "no-unused-vars": [
          "error",
          {
            caughtErrors: "all",
            caughtErrorsIgnorePattern: "^_",
          },
        ],
      },
    },
    {
      files: ["addon/bootstrap.js"],
      rules: {
        // Zotero invokes these top-level lifecycle functions by name.
        "no-unused-vars": "off",
      },
    },
  ],
});
