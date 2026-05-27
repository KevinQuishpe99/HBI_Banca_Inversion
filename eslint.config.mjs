import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Scripts Node (CommonJS) fuera del árbol Next
    "database/**",
    "check-setup.js",
    "test-direct.js",
    "test-password.js",
  ]),
  {
    rules: {
      // Legado: no bloquear el build; ir corrigiendo gradualmente
      "@typescript-eslint/no-explicit-any": "warn",
      "react/no-unescaped-entities": "off",
    },
  },
]);

export default eslintConfig;
