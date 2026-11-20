import { defineConfig, devices } from "@playwright/test";

// BASE_URL points the tests at an already running copy (for example a Service in the cluster).
// Without it, Playwright starts the bundled server itself.
const baseURL = process.env.BASE_URL || "http://localhost:4173";

export default defineConfig({
  testDir: "tests",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ["list"],
    ["junit", { outputFile: "test-results/junit.xml" }],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : { command: "node scripts/serve.mjs", url: `${baseURL}/healthz`, reuseExistingServer: !process.env.CI },
});
