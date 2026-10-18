import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@mastra/core",
    "@sentry/node",
    "@temporalio/client",
    "@temporalio/worker",
    "@temporalio/workflow",
    "mongodb",
    "pg",
  ],
};

export default nextConfig;
