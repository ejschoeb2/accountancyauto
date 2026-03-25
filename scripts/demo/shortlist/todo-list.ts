/**
 * Shortlist recording: To-Do List
 *
 * Open email modal, resend, paginate twice forward and once back,
 * open a file, pass review, close, then done.
 */

import {
  type DemoDefinition,
  login,
  cursorClick,
  cursorMove,
  injectCursor,
  wait,
  PAUSE,
} from "../helpers";

const demo: DemoDefinition = {
  id: "shortlist-todo-list",
  title: "To-Do List",
  description: "Open email, resend, paginate, open file, pass review, close.",
  tags: ["todo", "tasks", "dashboard"],
  category: "Dashboard",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);

    await injectCursor(page);

    // Check for empty state early exit
    const emptyState = page.locator('text=All caught up');
    if (await emptyState.isVisible().catch(() => false)) {
      await cursorMove(page, 'text=All caught up');
      await wait(PAUSE.READ);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
      await wait(PAUSE.MEDIUM);
      return;
    }

    // ── Open email modal ───────────────────────────────────────────────────
    const emailCta = page.locator('button:has-text("Open email")').first();
    if (await emailCta.isVisible().catch(() => false)) {
      await cursorClick(page, 'button:has-text("Open email")');
      await wait(PAUSE.LONG);
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 }).catch(() => {});
      await injectCursor(page);
      await wait(PAUSE.READ);

      // Resend email
      const resendBtn = page.locator('[role="dialog"] button:has-text("Resend")').first();
      if (await resendBtn.isVisible().catch(() => false)) {
        await cursorClick(page, '[role="dialog"] button:has-text("Resend")');
        await wait(PAUSE.LONG);
      }

      // Close modal
      await page.keyboard.press('Escape');
      await wait(PAUSE.MEDIUM);
    }

    // ── Paginate forward twice ─────────────────────────────────────────────
    const paginationContainer = page.locator('.flex.items-center.justify-end.gap-2.pt-4').first();
    const hasPagination = await paginationContainer.isVisible().catch(() => false);

    if (hasPagination) {
      const paginationBtns = paginationContainer.locator('button');
      await paginationContainer.evaluate((el) => el.scrollIntoView({ behavior: "smooth", block: "nearest" }));
      await wait(PAUSE.MEDIUM);
      await injectCursor(page);

      // Next page (first time)
      const nextBtn = paginationBtns.nth(1);
      if (!(await nextBtn.isDisabled())) {
        await cursorClick(page, '.flex.items-center.justify-end.gap-2.pt-4 >> button >> nth=1');
        await wait(PAUSE.READ);
      }

      // Next page (second time)
      if (!(await nextBtn.isDisabled())) {
        await cursorClick(page, '.flex.items-center.justify-end.gap-2.pt-4 >> button >> nth=1');
        await wait(PAUSE.READ);
      }

      // Back a page
      const prevBtn = paginationBtns.nth(0);
      if (!(await prevBtn.isDisabled())) {
        await cursorClick(page, '.flex.items-center.justify-end.gap-2.pt-4 >> button >> nth=0');
        await wait(PAUSE.MEDIUM);
      }
    }

    // ── Open file (document preview) ──────────────────────────────────────
    const openFileBtn = page.locator('button:has-text("Open file")').first();
    if (await openFileBtn.isVisible().catch(() => false)) {
      await cursorClick(page, 'button:has-text("Open file")');
      await wait(PAUSE.LONG);
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 }).catch(() => {});
      await injectCursor(page);
      await wait(PAUSE.READ);

      // Press Pass Review
      const passReviewBtn = page.locator('[role="dialog"] button:has-text("Pass Review")').first();
      if (await passReviewBtn.isVisible().catch(() => false)) {
        await cursorClick(page, '[role="dialog"] button:has-text("Pass Review")');
        await wait(PAUSE.LONG);
      }

      // Close modal
      await page.keyboard.press('Escape');
      await wait(PAUSE.MEDIUM);
    }

    // ── Scroll back to top ─────────────────────────────────────────────────
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await wait(PAUSE.MEDIUM);
  },
};

export default demo;
