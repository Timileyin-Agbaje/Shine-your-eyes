import { defineConfig, devices } from "@playwright/test";

const PORT = 8788;

// CI runs Chromium as a phone. PW_BROWSER=firefox is for machines where Chromium
// can't start (e.g. PRoot on Android); Firefox has no mobile emulation, so it
// gets the same 360x740 viewport with touch only.
const phone =
  process.env.PW_BROWSER === "firefox"
    ? { ...devices["Desktop Firefox"], viewport: { width: 360, height: 740 }, hasTouch: true }
    : { ...devices["Desktop Chrome"], viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true };

// See docs/TESTING.md: we test what a user does, end to end, at a phone viewport.
export default defineConfig({
  testDir: "e2e",
  // The suite talks to real sandbox wallets and relays; run tests one at a time.
  workers: 1,
  timeout: 60_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "phone",
      use: phone,
    },
  ],
  webServer: {
    command: "pnpm build && pnpm start",
    url: `http://localhost:${PORT}/api/health`,
    // Fixed BTC rates so amounts in local money are predictable.
    env: { PORT: String(PORT), SYE_DB_PATH: ":memory:", RATES_FIXED: "NGN:102000000,XOF:44600000" },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
