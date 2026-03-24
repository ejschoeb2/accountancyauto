/**
 * Shortlist recording: Recent Uploads
 *
 * Scroll to Recent Uploads, hover over rows, click a row to open
 * the document preview modal, close it, then scroll back to dashboard top.
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
  id: "shortlist-recent-uploads",
  title: "Recent Uploads",
  description: "See recently uploaded documents, preview one, then close.",
  tags: ["uploads", "documents", "dashboard"],
  category: "Dashboard",
  hasSideEffects: false,

  async record({ page }) {
    await login(page);

    // ---- Scroll to Recent Uploads ----
    const uploadsHeader = page.locator('text=Recent Uploads').first();
    await uploadsHeader.scrollIntoViewIfNeeded();
    await injectCursor(page);
    await wait(PAUSE.MEDIUM);

    await cursorMove(page, 'text=Recent Uploads');
    await wait(PAUSE.READ);

    // Check for empty state
    const emptyState = page.locator('text=No documents uploaded yet');
    if (await emptyState.isVisible().catch(() => false)) {
      await cursorMove(page, 'text=No documents uploaded yet');
      await wait(PAUSE.READ);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
      await wait(PAUSE.MEDIUM);
      return;
    }

    // ---- Hover over upload rows ----
    const uploadsCard = page.locator('text=Recent Uploads >> xpath=ancestor::*[contains(@class,"card")]').first();
    const uploadButtons = uploadsCard.locator('button[type="button"]');
    const uploadCount = await uploadButtons.count();

    if (uploadCount > 0) {
      await cursorMove(page, 'text=Recent Uploads >> xpath=ancestor::*[contains(@class,"card")] >> button[type="button"]', 0);
      await wait(PAUSE.READ);

      if (uploadCount > 1) {
        await cursorMove(page, 'text=Recent Uploads >> xpath=ancestor::*[contains(@class,"card")] >> button[type="button"]', 1);
        await wait(PAUSE.MEDIUM);
      }

      // Click to open document preview
      await cursorClick(page, 'text=Recent Uploads >> xpath=ancestor::*[contains(@class,"card")] >> button[type="button"]', 0);
      await wait(PAUSE.LONG);
      await wait(PAUSE.READ);

      // Close the modal
      await page.keyboard.press("Escape");
      await wait(PAUSE.MEDIUM);
    }

    // ---- Scroll back to dashboard top ----
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await wait(PAUSE.MEDIUM);
  },
};

export default demo;
