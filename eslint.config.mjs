import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import prettier from "eslint-config-prettier/flat";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores([
    "docs/**",
    "node_modules/**",
    "dist/**",
    "coverage/**",
    ".wrangler/**",
    ".vitest/**",
    "test-results/**",
    "playwright-report/**",
  ]),
  {
    files: ["**/*.{js,mjs,ts,tsx}"],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["src/client/**/*.{ts,tsx}"],
    extends: [reactHooks.configs.flat.recommended],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/localization/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...["Literal", "JSXText"].map((type) => ({
          selector: `${type}[value=/[\\u3040-\\u30ff\\u3400-\\u9fff]/]`,
          message: "表示文言はsrc/localization/ja.tsに定義してください。",
        })),
        {
          selector:
            "TemplateElement[value.raw=/[\\u3040-\\u30ff\\u3400-\\u9fff]/]",
          message:
            "文を分割せず、差し込み値を持つ文字列リソースにしてください。",
        },
      ],
    },
  },
  prettier,
]);
