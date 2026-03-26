/**
 * Recording: Review & Approve a Document Upload
 *
 * Navigate to the Activity page, switch to Uploads tab, find a row
 * with "Needs review" status, open the document preview modal,
 * click "Pass Review", navigate to the next file, then close.
 */

import {
  type DemoDefinition,
  login,
  navigateTo,
  cursorClick,
  cursorMove,
  wait,
  PAUSE,
  injectCursor,
} from "../helpers";

const demo: DemoDefinition = {
  id: "review-document-upload",
  title: "Review & Approve a Document Upload",
  description:
    "When a document is uploaded via the client portal, open the review modal to view the assessment, click Pass Review to approve it, then navigate to the next document.",
  tags: [
    "review",
    "approve",
    "document",
    "upload",
    "validation",
    "portal",
    "pass review",
  ],
  category: "Documents",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/activity");

    // ─── Switch to Uploads tab ───
    console.log("-> Switching to Uploads tab...");
    await cursorClick(page, 'button:has-text("Uploads")');
    await page.waitForLoadState("networkidle");
    await injectCursor(page);
    await wait(PAUSE.LONG);

    // ─── Wait for uploads table to load ───
    console.log("-> Waiting for uploads table...");
    const uploadsTable = page.locator("table");
    await uploadsTable.waitFor({ state: "visible", timeout: 10000 });
    await wait(PAUSE.MEDIUM);

    // Check for empty state
    const emptyState = page.locator('text="No portal uploads yet"');
    if (await emptyState.isVisible()) {
      console.log("-> No uploads available — showing empty state.");
      await wait(PAUSE.READ);
      return;
    }

    // ─── Look for a row with "Review needed" or "Needs review" badge ───
    console.log("-> Looking for a document that needs review...");
    const reviewRow = page.locator('table tbody tr:has-text("Review needed"), table tbody tr:has-text("review")').first();

    if (await reviewRow.isVisible()) {
      // Hover over the review needed badge
      await cursorMove(page, 'table tbody tr:has-text("Review needed"), table tbody tr:has-text("review")');
      await wait(PAUSE.MEDIUM);

      // Click on the row to open preview
      console.log("-> Opening document preview modal...");
      await cursorClick(page, 'table tbody tr:has-text("Review needed"), table tbody tr:has-text("review")');
    } else {
      // Fallback: click first available row
      console.log("-> No 'Review needed' rows found — opening first document...");
      await cursorClick(page, "table tbody tr", 0);
    }
    await wait(PAUSE.LONG);

    // ─── Document preview modal opens ───
    const dialog = page.locator('[role="dialog"]');
    await dialog.waitFor({ state: "visible", timeout: 5000 });
    console.log("-> Document preview modal opened...");
    await wait(PAUSE.MEDIUM);

    // ─── Review the assessment alert ───
    console.log("-> Reviewing assessment...");
    const assessmentAlert = page.locator('[role="dialog"] .bg-amber-500\\/10, [role="dialog"] .bg-red-500\\/10, [role="dialog"] .bg-green-500\\/10').first();
    if (await assessmentAlert.isVisible()) {
      await cursorMove(page, '[role="dialog"] .bg-amber-500\\/10, [role="dialog"] .bg-red-500\\/10, [role="dialog"] .bg-green-500\\/10');
      await wait(PAUSE.READ);
    }

    // ─── Click "Pass Review" button ───
    console.log("-> Clicking Pass Review...");
    const passReviewBtn = page.locator('[role="dialog"] button:has-text("Pass Review")').first();
    if (await passReviewBtn.isVisible()) {
      await cursorClick(page, '[role="dialog"] button:has-text("Pass Review")');
      await wait(PAUSE.LONG);

      // Wait for the review flag to be cleared
      console.log("-> Review flag cleared successfully...");
      await wait(PAUSE.READ);
    } else {
      // If no review button, show the current state
      console.log("-> No review needed for this document, showing current state...");
      await wait(PAUSE.READ);
    }

    // ─── Navigate to next file ───
    console.log("-> Navigating to next document...");
    const nextBtn = page.locator('[role="dialog"] button:has([class*="ChevronRight"]), [role="dialog"] button:has-text("Next")').first();

    // Try using the chevron right button for navigation
    const chevronNext = page.locator('[role="dialog"] button').filter({ has: page.locator('svg.lucide-chevron-right') }).first();
    if (await chevronNext.isVisible()) {
      await cursorClick(page, '[role="dialog"] button:has(svg.lucide-chevron-right)');
      await wait(PAUSE.LONG);
    }

    // ─── View the next document ───
    console.log("-> Viewing next document...");
    await wait(PAUSE.READ);

    // ─── Close the modal ───
    console.log("-> Closing preview modal...");
    await page.keyboard.press("Escape");
    await wait(PAUSE.MEDIUM);

    console.log("-> Document review demo complete.");
  },
};

export default demo;
