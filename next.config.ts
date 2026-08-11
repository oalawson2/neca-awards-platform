import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces .next/standalone: a self-contained server bundle (only the
  // node_modules a page actually needs) suited to cPanel's "Setup Node.js
  // App" hosting, where we don't want to run a full `npm install` in
  // production or rely on `next start`. See .cpanel.yml for how the
  // build output is assembled into the deploy path.
  output: "standalone",

  experimental: {
    // Defaults to (CPU count - 1) worker processes for the "Collecting
    // page data" build step. The shared hosting box this deploys to can't
    // fork that many workers — it fails with "ThreadPoolBuildError...
    // Resource temporarily unavailable". Pin it to 1.
    cpus: 1,

    // Documented as low-risk: trades a slight compile-time increase for
    // lower peak Webpack compiler memory. See node_modules/next/dist/docs/
    // 01-app/02-guides/memory-usage.md — this is the flag Next's own
    // memory-usage guide leads with for a Webpack build hitting OOM.
    webpackMemoryOptimizations: true,
  },

  // `next build` normally also runs a full-program TypeScript check on top
  // of compiling every route, and that type-check accounts for a real
  // share of build peak memory, separate from and in addition to
  // compilation. It's already run as its own step (`npx tsc --noEmit`)
  // before any build is considered done, so skipping it here doesn't
  // remove the safety net, it just moves that cost out of the constrained
  // build step. A type error will still fail the separate check, it just
  // won't fail `next build` itself.
  //
  // There's no equivalent `eslint` option here: Next 16 removed `next
  // lint` and the `eslint` config key entirely (see node_modules/next/
  // dist/docs/.../03-eslint.md) — this fork's package.json "lint" script
  // already runs the ESLint CLI directly, so there was never a built-in
  // lint pass inside `next build` to disable in the first place.
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
