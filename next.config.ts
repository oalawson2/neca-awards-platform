import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces .next/standalone: a self-contained server bundle (only the
  // node_modules a page actually needs) suited to cPanel's "Setup Node.js
  // App" hosting, where we don't want to run a full `npm install` in
  // production or rely on `next start`. See .cpanel.yml for how the
  // build output is assembled into the deploy path.
  output: "standalone",
};

export default nextConfig;
