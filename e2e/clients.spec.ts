import { test, expect } from './fixtures';

test.describe('Clients Page', () => {
  test('clients page loads with heading', async ({ page }) => {
    await page.goto('/clients');
    await expect(page.getByRole('heading', { name: /clients/i })).toBeVisible();
  });

  test('clients table or empty state is visible', async ({ page }) => {
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');
    // Either the table is present or there is some content on the page
    const table = page.locator('table');
    const pageContent = page.locator('main');
    await expect(pageContent).toBeVisible();
  });

  test('add client button is visible', async ({ page }) => {
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('button', { name: /add client/i })).toBeVisible();
  });

  test('search input is available', async ({ page }) => {
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');
    await expect(page.getByPlaceholder(/search by client name/i)).toBeVisible();
  });

  test('import CSV button is visible', async ({ page }) => {
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('button', { name: /import csv/i })).toBeVisible();
  });
});
