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
  },
};

export default nextConfig;
