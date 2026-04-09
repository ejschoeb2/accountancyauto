import { test, expect } from './fixtures';

test.describe('Authentication', () => {
  test('redirects unauthenticated users to login', async ({ browser }) => {
    const context = await browser.newContext(); // fresh context, no auth
    const page = await context.newPage();
    await page.goto('/clients');
    await expect(page).toHaveURL(/\/login/);
    await context.close();
  });

  test('authenticated user can access dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    // Should not be redirected to login
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('authenticated user can access clients page', async ({ page }) => {
    await page.goto('/clients');
    await expect(page).toHaveURL(/\/clients/);
    await page.waitForLoadState('networkidle');
  });

  test('login page shows sign in form', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /sign in to prompt/i })).toBeVisible();
    await expect(page.getByLabel(/email address/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
    await context.close();
  });
});
