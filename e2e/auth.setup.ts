import { test as setup, expect } from '@playwright/test';
import { hideDevOverlay } from './helpers';

const authFile = 'e2e/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Navigate to login and wait for page to be ready
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  // Hide Next.js dev overlay — it intercepts pointer events and blocks clicks
  await hideDevOverlay(page);

  // Fill credentials using input type selectors (matches demo script pattern)
  await page.locator('input[type="email"]').fill(process.env.E2E_USER_EMAIL || 'test@example.com');
  await page.locator('input[type="password"]').fill(process.env.E2E_USER_PASSWORD || 'testpassword123');

  // Click submit button
  await page.locator('button[type="submit"]').click();

  // Wait for redirect to dashboard (dev mode redirects to /dashboard?org=slug)
  await page.waitForURL('**/dashboard**', { timeout: 15000 });

  // Save signed-in state
  await page.context().storageState({ path: authFile });
});
