import { Page, expect } from '@playwright/test';

/**
 * Hide the Next.js dev overlay (<nextjs-portal>) which intercepts pointer events
 * and blocks Playwright clicks. Same approach as the demo recording scripts.
 */
export async function hideDevOverlay(page: Page) {
  await page.addStyleTag({
    content: [
      'nextjs-portal { display: none !important; }',
      '#__nextjs-toast-errors-parent { display: none !important; }',
      '#__vercel_toolbar { display: none !important; }',
      '#vercel-toolbar { display: none !important; }',
      '.__vercel_toolbar_container { display: none !important; }',
    ].join(' '),
  });
}

/** Wait for the dashboard to fully load */
export async function waitForDashboard(page: Page) {
  await page.waitForLoadState('networkidle');
  await hideDevOverlay(page);
}

/** Navigate to a section via the nav bar */
export async function navigateTo(page: Page, section: string) {
  await page.getByRole('link', { name: new RegExp(section, 'i') }).click();
  await page.waitForLoadState('networkidle');
  await hideDevOverlay(page);
}
