import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    channel: "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop-chrome",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } },
    },
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    {
      command: "node --import tsx apps/server/src/index.ts",
      url: "http://127.0.0.1:3101/api/v1/health",
      reuseExistingServer: false,
      env: { SERVER_PORT: "3101", WEB_ORIGIN: "http://127.0.0.1:3100", NODE_ENV: "test" },
    },
    {
      command: "npx next dev apps/web --port 3100 --hostname 127.0.0.1",
      url: "http://127.0.0.1:3100",
      reuseExistingServer: false,
      timeout: 120_000,
      env: { API_INTERNAL_URL: "http://127.0.0.1:3101", ALLPLAY_E2E: "1" },
    },
  ],
});
