/**
 * Recording: Review Recent Document Uploads
 *
 * Login to the dashboard, scroll to the Recent Uploads section, browse
 * the upload rows, click on a row with "Review" badge to open the
 * document preview modal, pass review on it, then close.
 *
 * Seed data includes documents with needs_review=true (Coastal Catering
 * and Oakwood Property Management) so there should be reviewable uploads.
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
    "Scroll through recent uploads, open a document that needs review, pass review on it, and close.",
  tags: ["uploads", "documents", "recent", "dashboard", "review", "preview", "approve"],
  category: "Dashboard",
  hasSideEffects: true,

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
      console.log("-> Empty state — no uploads yet.");
      await cursorMove(page, 'text=No documents uploaded yet');
      await wait(PAUSE.READ);
      return;
    }

    // ---- Browse the upload rows ----
    console.log("-> Browsing upload rows...");
    // Upload rows are buttons inside the card
    const uploadCard = page.locator('text=Recent Uploads').locator('xpath=ancestor::*[contains(@class,"card")]').first();
    const uploadRows = uploadCard.locator('button[type="button"]');
    const uploadCount = await uploadRows.count();

    if (uploadCount > 1) {
      // Hover over a couple of rows to show the list
      await cursorMove(page, 'button[type="button"].hover\\:bg-muted\\/50', 0);
      await wait(PAUSE.SHORT);
      await cursorMove(page, 'button[type="button"].hover\\:bg-muted\\/50', 1);
      await wait(PAUSE.SHORT);
    }

    // ---- Paginate if there's more than one page ----
    const nextPageBtn = uploadCard.locator('button:has(svg.lucide-chevron-right)');
    if (await nextPageBtn.isVisible().catch(() => false)) {
      const isDisabled = await nextPageBtn.isDisabled();
      if (!isDisabled) {
        console.log("-> Paginating to next page...");
        await nextPageBtn.scrollIntoViewIfNeeded();
        await injectCursor(page);
        await cursorClick(page, 'button:has(svg.lucide-chevron-right)');
        await wait(PAUSE.READ);

        // Go back to first page
        console.log("-> Going back to first page...");
        const prevPageBtn = uploadCard.locator('button:has(svg.lucide-chevron-left)');
        if (await prevPageBtn.isVisible().catch(() => false) && !(await prevPageBtn.isDisabled())) {
          await cursorClick(page, 'button:has(svg.lucide-chevron-left)');
          await wait(PAUSE.MEDIUM);
        }
      }
    }

    // ---- Find and click a row with "Review" badge ----
    console.log("-> Looking for an upload that needs review...");
    const reviewRow = uploadCard.locator('button:has-text("Review")').first();
    if (await reviewRow.isVisible().catch(() => false)) {
      await reviewRow.scrollIntoViewIfNeeded();
      await injectCursor(page);
      await cursorMove(page, 'button:has-text("Review")');
      await wait(PAUSE.MEDIUM);

      console.log("-> Opening document that needs review...");
      await cursorClick(page, 'button:has-text("Review")');
    } else {
      // Fallback: click first upload row
      console.log("-> No review-needed rows found — opening first document...");
      await uploadRows.first().scrollIntoViewIfNeeded();
      await injectCursor(page);
      await cursorClick(page, 'button[type="button"].hover\\:bg-muted\\/50', 0);
    }
    await wait(PAUSE.LONG);

    // ---- Document preview modal ----
    const dialog = page.locator('[role="dialog"]');
    await dialog.waitFor({ state: "visible", timeout: 5000 });
    console.log("-> Document preview modal opened...");
    await wait(PAUSE.MEDIUM);

    // ---- Review the assessment alert if visible ----
    const assessmentAlert = dialog.locator('.bg-amber-500\\/10, .bg-red-500\\/10, .bg-green-500\\/10').first();
    if (await assessmentAlert.isVisible().catch(() => false)) {
      console.log("-> Reviewing assessment...");
      await cursorMove(page, '[role="dialog"] .bg-amber-500\\/10, [role="dialog"] .bg-red-500\\/10, [role="dialog"] .bg-green-500\\/10');
      await wait(PAUSE.READ);
    }

    // ---- Click "Pass Review" button ----
    const passReviewBtn = dialog.locator('button:has-text("Pass Review")').first();
    if (await passReviewBtn.isVisible().catch(() => false)) {
      console.log("-> Clicking Pass Review...");
      await cursorClick(page, '[role="dialog"] button:has-text("Pass Review")');
      await wait(PAUSE.LONG);
      console.log("-> Review passed successfully.");
      await wait(PAUSE.MEDIUM);
    } else {
      console.log("-> No review needed for this document.");
      await wait(PAUSE.READ);
    }

    // ---- Navigate to next item in the modal ----
    const nextItemBtn = dialog.locator('button:has(svg.lucide-chevron-right)').first();
    if (await nextItemBtn.isVisible().catch(() => false) && !(await nextItemBtn.isDisabled())) {
      console.log("-> Navigating to next document...");
      await cursorClick(page, '[role="dialog"] button:has(svg.lucide-chevron-right)');
      await wait(PAUSE.LONG);
      await wait(PAUSE.READ);
    }

    // ---- Close the modal ----
    console.log("-> Closing document preview modal...");
    await page.keyboard.press("Escape");
    await wait(PAUSE.MEDIUM);

    console.log("-> Recent uploads demo complete.");
    await wait(PAUSE.SHORT);
  },
};

export default demo;
