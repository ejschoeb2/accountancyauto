import { Page, expect } from '@playwright/test';

/** Wait for the dashboard to fully load */
export async function waitForDashboard(page: Page) {
  await page.waitForLoadState('networkidle');
}

/** Navigate to a section via the nav bar */
export async function navigateTo(page: Page, section: string) {
  await page.getByRole('link', { name: new RegExp(section, 'i') }).click();
  await page.waitForLoadState('networkidle');
}
