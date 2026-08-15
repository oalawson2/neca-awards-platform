import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces .next/standalone: a self-contained server bundle (only the
  // node_modules a page actually needs) suited to cPanel's "Setup Node.js
  // App" hosting, where we don't want to run a full `npm install` in
  // production or rely on `next start`. See .cpanel.yml for how the
  // build output is assembled into the deploy path.
  output: "standalone",

  experimental: {
    // Server Actions default to a 1MB request body cap. lib/actions/
    // documents.ts's uploadDocument accepts raw uploads (pre-compression)
    // up to 8MB — an unedited phone photo comfortably exceeds 1MB — so
    // without this the upload would 413 before ever reaching the
    // compression code that's meant to handle exactly that case. Left
    // with headroom above the 8MB check for multipart overhead.
    serverActions: {
      bodySizeLimit: "10mb",
    },

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

    // Tried and measured `webpackBuildWorker: false` here (forces the
    // Webpack compiler to run inside the main `next build` process instead
    // of the forked child process it uses by default — see
    // node_modules/next/dist/build/webpack-build/index.js, where that
    // worker is already hardcoded to numWorkers: 1, so no parallelism was
    // left to strip out of it, only the process boundary itself). It made
    // things markedly worse, not better: two measured runs came back at
    // 1346MB and 1560MB peak RSS, well above every measurement with the
    // default (worker-on) config. Best explanation: the forked worker gets
    // fully reclaimed by the OS the instant it exits after compiling,
    // which the main (long-lived) process never gets — running in-process
    // just accumulates the whole build's memory in one heap with no clean
    // point to release any of it. Left explicitly unset (default: true)
    // rather than removed outright, so nobody re-tries this blind.
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
