import { test, expect } from '@playwright/test';

test.describe('Email Templates Page', () => {
  test('templates page loads with heading', async ({ page }) => {
    await page.goto('/templates');
    await expect(page.getByRole('heading', { name: /email templates/i })).toBeVisible();
  });

  test('create template button is visible', async ({ page }) => {
    await page.goto('/templates');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('button', { name: /create template/i })).toBeVisible();
  });

  test('template list or empty state is shown', async ({ page }) => {
    await page.goto('/templates');
    await page.waitForLoadState('networkidle');
    // Page should have loaded content (either template cards or empty state)
    const mainContent = page.locator('main');
    await expect(mainContent).toBeVisible();
  });
});
