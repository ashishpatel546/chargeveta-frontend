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
    // The service worker. It is not part of the bundle and does not run in a
    // window: `self` there is a ServiceWorkerGlobalScope, which these rules
    // have no way to know.
    "public/sw.js",
  ]),
]);

export default eslintConfig;
