import { test, expect } from '@playwright/test';

test.describe('Core Navigation', () => {
  test('dashboard link navigates correctly', async ({ page }) => {
    await page.goto('/clients');
    await page.getByRole('link', { name: /dashboard/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('clients link navigates correctly', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: /^clients$/i }).click();
    await expect(page).toHaveURL(/\/clients/);
  });

  test('activity link navigates correctly', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: /activity/i }).click();
    await expect(page).toHaveURL(/\/activity/);
  });

  test('deadlines link navigates correctly', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: /deadlines/i }).click();
    await expect(page).toHaveURL(/\/deadlines/);
  });

  test('email templates link navigates correctly', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: /email templates/i }).click();
    await expect(page).toHaveURL(/\/templates/);
  });

  test('all main pages load without error', async ({ page }) => {
    const routes = ['/dashboard', '/clients', '/activity', '/deadlines', '/templates', '/settings'];
    for (const route of routes) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      // Should not be redirected to login
      await expect(page).not.toHaveURL(/\/login/);
      // Page should not show a Next.js error overlay
      await expect(page.locator('nextjs-portal')).toHaveCount(0);
    }
  });
});
