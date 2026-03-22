/**
 * Recording: Review & Approve a Document Upload
 *
 * Navigate to the Activity page, switch to Uploads tab, click on an
 * uploaded document row to open the preview modal, review validation
 * status and warnings.
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
    "When a document is uploaded via the client portal, review the validation result and approve or reject it.",
  tags: [
    "review",
    "approve",
    "reject",
    "document",
    "upload",
    "validation",
    "portal",
  ],
  category: "Documents",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/activity");

    // ─── Switch to Uploads tab ───
    console.log("→ Switching to Uploads tab...");
    await cursorClick(page, 'button:has-text("Uploads")');
    await page.waitForLoadState("networkidle");
    await injectCursor(page);
    await wait(PAUSE.LONG);

    // ─── Wait for uploads table to load ───
    console.log("→ Waiting for uploads table...");
    const uploadsTable = page.locator("table");
    await uploadsTable.waitFor({ state: "visible", timeout: 10000 });
    await wait(PAUSE.MEDIUM);

    // Check for empty state
    const emptyState = page.locator("text=No portal uploads yet");
    if (await emptyState.isVisible()) {
      console.log("→ No uploads available — showing empty state.");
      await wait(PAUSE.READ);
      return;
    }

    // ─── Browse the uploads table ───
    console.log("→ Browsing upload rows...");
    await cursorMove(page, "table tbody tr", 0);
    await wait(PAUSE.MEDIUM);

    // Hover over the verdict badge
    const verdictBadge = page.locator("table tbody tr .rounded-md").first();
    if (await verdictBadge.isVisible()) {
      await cursorMove(page, "table tbody tr .rounded-md", 0);
      await wait(PAUSE.MEDIUM);
    }

    // ─── Click on a row to open document preview ───
    console.log("→ Clicking on an upload to open preview...");
    await cursorClick(page, "table tbody tr.cursor-pointer", 0);
    await wait(PAUSE.MEDIUM);

    // ─── Document preview modal opens ───
    const dialog = page.locator('[role="dialog"]');
    await dialog.waitFor({ state: "visible", timeout: 5000 });
    console.log("→ Document preview modal opened...");
    await wait(PAUSE.LONG);

    // ─── Review document details ───
    console.log("→ Reviewing document classification and metadata...");
    // Scroll within the modal to see validation details
    await cursorMove(page, '[role="dialog"] h2, [role="dialog"] [class*="DialogTitle"]');
    await wait(PAUSE.READ);

    // Look for validation warnings section
    const warningsSection = page.locator('[role="dialog"]:has-text("Validation"), [role="dialog"]:has-text("warning")');
    if (await warningsSection.isVisible()) {
      console.log("→ Viewing validation warnings...");
      await wait(PAUSE.READ);
    }

    // ─── View extracted details ───
    console.log("→ Viewing extracted document details...");
    const extractedDetails = page.locator('[role="dialog"] dl, [role="dialog"]:has-text("Extracted")');
    if (await extractedDetails.isVisible()) {
      await cursorMove(page, '[role="dialog"] dl', 0);
      await wait(PAUSE.READ);
    }

    // ─── Close the preview modal ───
    console.log("→ Closing preview modal...");
    await page.keyboard.press("Escape");
    await wait(PAUSE.MEDIUM);

    console.log("→ Document upload review demo complete.");
  },
};

export default demo;
