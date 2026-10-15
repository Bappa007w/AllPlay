import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.ALLPLAY_LIVE_URL;
if (!baseURL || !baseURL.startsWith("https://")) {
  throw new Error("Set ALLPLAY_LIVE_URL to the approved live HTTPS origin");
}

// Explicit opt-in: creates disposable rooms on the target and closes them on success.
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["rooms.spec.ts", "roles.spec.ts"],
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 30_000 },
  reporter: "list",
  use: {
    baseURL,
    channel: "chrome",
    trace: "off",
    screenshot: "off",
  },
  projects: [
    { name: "live-desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "live-mobile", use: { ...devices["Pixel 7"] } },
  ],
});
