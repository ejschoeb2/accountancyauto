import { test as base } from '@playwright/test';
import { hideDevOverlay } from './helpers';

/**
 * Extended test fixture that automatically hides the Next.js dev overlay
 * after every page navigation. Without this, the <nextjs-portal> element
 * intercepts all pointer events and blocks Playwright clicks.
 *
 * Same approach as /scripts/demo/helpers.ts (HIDE_CSS injection).
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    // Intercept every navigation and inject the overlay-hiding CSS
    page.on('load', async () => {
      try {
        await hideDevOverlay(page);
      } catch {
        // Page may have been closed or navigated away — ignore
      }
    });
    await use(page);
  },
});

export { expect } from '@playwright/test';
