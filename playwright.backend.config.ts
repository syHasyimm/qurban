import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/backend",
  workers: 1,
  fullyParallel: false,
  timeout: 120000,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report/backend", open: "never" }],
  ],
  outputDir: "test-results/backend",
  use: {
    baseURL: "http://localhost:3002",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "backend-chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
