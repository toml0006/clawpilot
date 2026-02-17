import { defineConfig, devices } from "@playwright/test";
import path from "path";

const baseURL = "http://127.0.0.1:3060";
const testDatabaseUrl = `file:${path.resolve(process.cwd(), "e2e.db")}`;
const testAgentToken = "test-agent-token";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "pnpm exec tsx e2e/global-setup.ts && pnpm dev",
    url: baseURL,
    reuseExistingServer: false,
    env: {
      ...process.env,
      DATABASE_URL: testDatabaseUrl,
      CLAWPILOT_AGENT_TOKEN: testAgentToken,
      NODE_ENV: "test",
    },
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
});
