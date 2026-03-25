/**
 * Shortlist recording: Upcoming Deadlines Widget (merged with Recent Uploads)
 *
 * Smooth-scroll to Recent Uploads, interact with rows and pagination,
 * open a document preview, pass review, then scroll to Upcoming Deadlines,
 * paginate, click a client, toggle deadline view tabs, and return to dashboard.
 */

import { type Page } from "playwright";
import {
  type DemoDefinition,
  login,
  navigateTo,
  cursorClick,
  cursorMove,
  injectCursor,
  wait,
  PAUSE,
} from "../helpers";

/** Smooth-scroll an element into view using the browser's smooth scroll API */
async function smoothScrollTo(page: Page, selector: string) {
  await page.locator(selector).first().evaluate((el) => {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  await new Promise((r) => setTimeout(r, 1200));
}

const demo: DemoDefinition = {
  id: "shortlist-upcoming-deadlines-widget",
  title: "Upcoming Deadlines Widget",
  description: "Recent uploads review then upcoming deadlines pagination and client drill-down.",
  tags: ["deadlines", "upcoming", "dashboard", "uploads", "documents"],
  category: "Dashboard",
  hasSideEffects: false,

  async record({ page }) {
    await login(page);

    // ── Recent Uploads section ──────────────────────────────────────────────
    // Smooth scroll down to Recent Uploads
    await smoothScrollTo(page, 'text=Recent Uploads');
    await injectCursor(page);
    await wait(PAUSE.MEDIUM);

    const uploadsCard = page.locator('text=Recent Uploads >> xpath=ancestor::*[contains(@class,"card")]').first();
    const uploadButtons = uploadsCard.locator('button[type="button"]');
    const uploadCount = await uploadButtons.count();

    if (uploadCount > 0) {
      // Go straight to first row (no header hover)
      await cursorMove(page, 'text=Recent Uploads >> xpath=ancestor::*[contains(@class,"card")] >> button[type="button"]', 0);
      await wait(PAUSE.READ);

      // Go down one row
      if (uploadCount > 1) {
        await cursorMove(page, 'text=Recent Uploads >> xpath=ancestor::*[contains(@class,"card")] >> button[type="button"]', 1);
        await wait(PAUSE.MEDIUM);
      }

      // Paginate: next then back
      const uploadsPagination = uploadsCard.locator('.flex.items-center.justify-end.gap-2.pt-4').first();
      const hasPagination = await uploadsPagination.isVisible().catch(() => false);
      if (hasPagination) {
        const uploadPageBtns = uploadsPagination.locator('button');
        const btnCount = await uploadPageBtns.count();
        if (btnCount >= 2 && !(await uploadPageBtns.nth(1).isDisabled())) {
          await cursorClick(page, 'text=Recent Uploads >> xpath=ancestor::*[contains(@class,"card")] >> .flex.items-center.justify-end.gap-2.pt-4 >> button >> nth=1');
          await wait(PAUSE.READ);
          if (!(await uploadPageBtns.nth(0).isDisabled())) {
            await cursorClick(page, 'text=Recent Uploads >> xpath=ancestor::*[contains(@class,"card")] >> .flex.items-center.justify-end.gap-2.pt-4 >> button >> nth=0');
            await wait(PAUSE.MEDIUM);
          }
        }
      }

      // Click a row to open document preview modal
      await cursorClick(page, 'text=Recent Uploads >> xpath=ancestor::*[contains(@class,"card")] >> button[type="button"]', 0);
      await wait(PAUSE.LONG);
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 }).catch(() => {});
      await injectCursor(page);
      await wait(PAUSE.READ);

      // Press Reject
      const rejectBtn = page.locator('[role="dialog"] button:has-text("Reject")').first();
      if (await rejectBtn.isVisible().catch(() => false)) {
        await cursorClick(page, '[role="dialog"] button:has-text("Reject")');
        await wait(PAUSE.LONG);
      }

      // Close modal
      await page.keyboard.press('Escape');
      await wait(PAUSE.MEDIUM);
    }

    // ── Upcoming Deadlines section ──────────────────────────────────────────
    // Smooth scroll to upcoming deadlines
    await smoothScrollTo(page, 'text=Upcoming Deadlines');
    await injectCursor(page);
    await wait(PAUSE.MEDIUM);

    const cardSelector = 'text=Upcoming Deadlines >> xpath=ancestor::*[contains(@class,"card")]';
    const clientLinks = page.locator(`${cardSelector} >> a`);
    const linkCount = await clientLinks.count();

    if (linkCount > 0) {
      // Go straight to first row
      await cursorMove(page, `${cardSelector} >> a`, 0);
      await wait(PAUSE.READ);

      // Go down two rows
      if (linkCount > 1) {
        await cursorMove(page, `${cardSelector} >> a`, 1);
        await wait(PAUSE.MEDIUM);
      }
      if (linkCount > 2) {
        await cursorMove(page, `${cardSelector} >> a`, 2);
        await wait(PAUSE.MEDIUM);
      }

      // Paginate: next page then back
      const paginationContainer = page.locator(`${cardSelector} >> .flex.items-center.justify-end.gap-2.pt-4`).first();
      const paginationVisible = await paginationContainer.isVisible().catch(() => false);
      if (paginationVisible) {
        const paginationBtns = paginationContainer.locator('button');
        const btnCount = await paginationBtns.count();
        if (btnCount >= 2 && !(await paginationBtns.nth(1).isDisabled())) {
          await cursorClick(page, `${cardSelector} >> .flex.items-center.justify-end.gap-2.pt-4 >> button >> nth=1`);
          await wait(PAUSE.READ);
          if (!(await paginationBtns.nth(0).isDisabled())) {
            await cursorClick(page, `${cardSelector} >> .flex.items-center.justify-end.gap-2.pt-4 >> button >> nth=0`);
            await wait(PAUSE.MEDIUM);
          }
        }
      }

      // Click a client row to navigate to individual client page
      await cursorClick(page, `${cardSelector} >> a`, 0);
      await page.waitForLoadState('networkidle');
      await injectCursor(page);
      await wait(PAUSE.READ);

      // Toggle between Documents and Emails on a deadline
      const emailsToggle = page.locator('button:has-text("Emails")').first();
      if (await emailsToggle.isVisible().catch(() => false)) {
        await cursorClick(page, 'button:has-text("Emails")');
        await wait(PAUSE.READ);
        // Toggle back to Documents
        const docsToggle = page.locator('button:has-text("Documents")').first();
        if (await docsToggle.isVisible().catch(() => false)) {
          await cursorClick(page, 'button:has-text("Documents")');
          await wait(PAUSE.MEDIUM);
        }
      }
    }

    // ── Back to dashboard ───────────────────────────────────────────────────
    await navigateTo(page, '/dashboard');
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await wait(PAUSE.MEDIUM);
  },
};

export default demo;
