// e2e/forgot-reset.spec.ts
//
// Purpose:
// - Simulate the user clicking "Forgot password", typing email, submitting,
//   and seeing success.
// - Intercepts the /api/auth/forgot-password request and returns { ok: true }.
// - This keeps it deterministic and fast in CI.
//
// Prereq:
// - Run your dev server in another terminal: npm run dev
// - Then run Playwright: npx playwright test

import { test, expect } from "@playwright/test";

test("Forgot password flow shows success toast", async ({ page }) => {
  // 1) Go to login page
  await page.goto("/login");

  // 2) Click "Forgot password?" link — adjust selector to match your markup
  await page.getByRole("link", { name: /forgot/i }).click();

  // 3) Intercept the POST to /api/auth/forgot-password so we don't send real emails
  await page.route("**/api/auth/forgot-password", async (route) => {
    // Simulate successful backend response
    await route.fulfill({
      status: 200,
      body: JSON.stringify({ ok: true }),
      headers: { "Content-Type": "application/json" },
    });
  });

  // 4) Fill email input and submit — adjust selectors as needed
  await page.fill('input[type="email"]', "user@example.com");
  await page.click('button[type="submit"]');

  // 5) Expect some success message (toast or UI text)
  // If using react-hot-toast, the DOM structure will vary; assert on visible text.
  await expect(page.getByText(/reset link has been sent/i)).toBeVisible();
});
