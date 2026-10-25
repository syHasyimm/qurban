import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // A separate output keeps integration tests from replacing the local dev build.
  distDir: process.env.QURBAN_TEST_RUN === "1" ? ".next/backend-test" : ".next",
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
