// tests/e2e/email-preview.spec.ts
//
// Purpose:
// - Lightweight E2E check that the email preview route renders in the browser.
// - Validates the template compiles and shows expected text.
//
// Usage:
// - Requires Playwright: npm i -D @playwright/test
// - Run: npx playwright test

import { test, expect } from "@playwright/test";

test("email preview page renders", async ({ page }) => {
  await page.goto("http://localhost:3000/email-preview/reset");
  await expect(page.getByRole("heading", { name: /Reset Password Email — Preview/i })).toBeVisible();
  await expect(page.locator("text=Reset your password")).toBeVisible();
});
