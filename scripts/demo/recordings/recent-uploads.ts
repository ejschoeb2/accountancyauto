/**
 * Recording: Review Recent Document Uploads
 *
 * Login to the dashboard, scroll to the Recent Uploads section, see upload
 * rows, click a row to open the document preview modal, pause to show the
 * modal content, then close the modal.
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
  id: "recent-uploads",
  title: "Review Recent Document Uploads",
  description:
    "See recently uploaded documents, click a row to open the document preview modal, and close it.",
  tags: ["uploads", "documents", "recent", "dashboard", "review", "preview"],
  category: "Dashboard",
  hasSideEffects: false,

  async record({ page }) {
    await login(page);

    // ---- Scroll to the Recent Uploads section ----
    console.log("-> Scrolling to Recent Uploads...");
    const uploadsHeader = page.locator('text=Recent Uploads').first();
    await uploadsHeader.scrollIntoViewIfNeeded();
    await injectCursor(page);
    await wait(PAUSE.MEDIUM);

    // ---- Highlight the section header ----
    await cursorMove(page, 'text=Recent Uploads');
    await wait(PAUSE.READ);

    // ---- Check for empty state ----
    const emptyState = page.locator('text=No documents uploaded yet');
    if (await emptyState.isVisible().catch(() => false)) {
      console.log("-> Empty state — no uploads yet...");
      await cursorMove(page, 'text=No documents uploaded yet');
      await wait(PAUSE.READ);
      console.log("-> Recent uploads demo complete (empty state).");
      return;
    }

    // ---- Hover over upload rows ----
    // Each row is a <button> element (not a link) that opens DocumentPreviewModal
    const uploadsCard = page.locator('text=Recent Uploads >> xpath=ancestor::*[contains(@class,"card")]').first();
    const uploadButtons = uploadsCard.locator('button[type="button"]');
    const uploadCount = await uploadButtons.count();

    if (uploadCount > 0) {
      console.log("-> Hovering over first upload...");
      await cursorMove(page, 'text=Recent Uploads >> xpath=ancestor::*[contains(@class,"card")] >> button[type="button"]', 0);
      await wait(PAUSE.READ);

      if (uploadCount > 1) {
        console.log("-> Hovering over second upload...");
        await cursorMove(page, 'text=Recent Uploads >> xpath=ancestor::*[contains(@class,"card")] >> button[type="button"]', 1);
        await wait(PAUSE.MEDIUM);
      }

      if (uploadCount > 2) {
        console.log("-> Hovering over third upload...");
        await cursorMove(page, 'text=Recent Uploads >> xpath=ancestor::*[contains(@class,"card")] >> button[type="button"]', 2);
        await wait(PAUSE.MEDIUM);
      }

      // ---- Click a row to open document preview modal ----
      console.log("-> Clicking an upload to open document preview...");
      await cursorClick(page, 'text=Recent Uploads >> xpath=ancestor::*[contains(@class,"card")] >> button[type="button"]', 0);

      // Wait for modal to load (fetches document data from Supabase)
      await wait(PAUSE.LONG);

      // Pause so viewer can see the document preview modal content
      console.log("-> Showing document preview modal...");
      await wait(PAUSE.READ);

      // ---- Close the modal ----
      console.log("-> Closing document preview modal...");
      await page.keyboard.press("Escape");
      await wait(PAUSE.MEDIUM);
    }

    console.log("-> Recent uploads demo complete.");
    await wait(PAUSE.READ);
  },
};

export default demo;
