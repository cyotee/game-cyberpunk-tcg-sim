import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90000,
  use: {
    baseURL: process.env.E2E_ORIGIN ?? "http://127.0.0.1:5174",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "firefox", use: { browserName: "firefox" } },
    { name: "webkit", use: { browserName: "webkit", trace: "off" } },
  ],
  workers: 1,
  webServer: {
    command: "node --import tsx tests/serve.ts",
    url:
      (process.env.E2E_ORIGIN ?? "http://127.0.0.1:5174") + "/api?route=health",
    reuseExistingServer: false,
    timeout: 60000,
  },
  reporter: "list",
});
