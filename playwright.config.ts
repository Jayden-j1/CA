// playwright.config.ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  use: {
    headless: true,
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
  },
});
