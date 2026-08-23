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
    // deploy.sh's isolated build directory (see next.config.ts's distDir
    // override) — same reason ".next/**" is ignored above. A leftover
    // .next-build/ from an interrupted or failed deploy.sh run (it's
    // deliberately left in place on smoke-test failure, for inspection)
    // would otherwise flood `npm run lint` with thousands of errors from
    // compiled output.
    ".next-build/**",
  ]),
]);

export default eslintConfig;
