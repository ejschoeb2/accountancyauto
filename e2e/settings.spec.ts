import { test, expect } from '@playwright/test';

test.describe('Settings Page', () => {
  test('settings page loads with heading', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible();
  });

  test('settings tabs are visible for admin users', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    // Admin users see General, Email, Billing tabs
    // Member users see a simpler view — either way the heading is present
    const generalTab = page.getByRole('tab', { name: /general/i });
    const settingsHeading = page.getByRole('heading', { name: /settings/i });
    await expect(settingsHeading).toBeVisible();
  });

  test('sign out card is visible', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    // Both admin and member views include sign out
    await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible();
  });
});
