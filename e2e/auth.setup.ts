import { test as setup, expect } from '@playwright/test';

const authFile = 'e2e/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Navigate to login
  await page.goto('/login');

  // Fill in test credentials from env vars
  await page.getByLabel(/email address/i).fill(process.env.E2E_USER_EMAIL || 'test@example.com');
  await page.getByLabel(/password/i).fill(process.env.E2E_USER_PASSWORD || 'testpassword123');

  // Click sign in button
  await page.getByRole('button', { name: /sign in/i }).click();

  // Wait for redirect to dashboard (auth redirects away from /login)
  await page.waitForURL(/\/(dashboard|clients|$)/, { timeout: 15000 });

  // Save signed-in state
  await page.context().storageState({ path: authFile });
});
