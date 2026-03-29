/**
 * Recording: View Upload Activity Log
 *
 * Navigate to /activity, switch to the Uploads tab, browse the table,
 * click on an upload row to open the preview modal, then paginate
 * through documents using next/previous buttons.
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
  id: "view-upload-activity",
  title: "View Upload Activity Log",
  description:
    "View all document uploads with their validation status. Click on an upload to preview it and navigate between documents in the modal.",
  tags: ["uploads", "activity", "log", "documents", "validation", "status"],
  category: "Documents",
  hasSideEffects: false,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/activity");

    // ─── Switch to Uploads tab ───
    console.log("-> Switching to Uploads tab...");
    await cursorClick(page, 'button:has-text("Uploads")');
    await page.waitForLoadState("networkidle");
    await injectCursor(page);
    await wait(PAUSE.MEDIUM);

    // ─── Wait for table to load ───
    const uploadsTable = page.locator("table");
    await uploadsTable.waitFor({ state: "visible", timeout: 10000 });

    // Check for empty state
    const emptyState = page.locator('text="No portal uploads yet"');
    if (await emptyState.isVisible()) {
      console.log("-> No uploads available.");
      await wait(PAUSE.READ);
      return;
    }

    // ─── Browse the table ───
    console.log("-> Browsing uploads table...");
    const rowCount = await page.locator("table tbody tr").count();
    if (rowCount > 0) {
      await cursorMove(page, "table tbody tr", 0);
      await wait(PAUSE.SHORT);
    }
    if (rowCount > 1) {
      await cursorMove(page, "table tbody tr", 1);
      await wait(PAUSE.SHORT);
    }
    if (rowCount > 2) {
      await cursorMove(page, "table tbody tr", 2);
      await wait(PAUSE.SHORT);
    }
    await wait(PAUSE.MEDIUM);

    // ─── Click on a row to open the preview modal ───
    console.log("-> Opening upload preview modal...");
    if (rowCount > 0) {
      await cursorClick(page, "table tbody tr", 0);
      await wait(PAUSE.LONG);

      const dialog = page.locator('[role="dialog"]');
      if (await dialog.isVisible().catch(() => false)) {
        console.log("-> Preview modal open — viewing document details...");
        await wait(PAUSE.READ);

        // ─── Navigate to next document ───
        const nextBtn = dialog.locator('button:has(svg.lucide-chevron-right)').first();
        if (await nextBtn.isVisible().catch(() => false) && !(await nextBtn.isDisabled())) {
          console.log("-> Navigating to next document...");
          await cursorClick(page, '[role="dialog"] button:has(svg.lucide-chevron-right)');
          await wait(PAUSE.LONG);
          await wait(PAUSE.MEDIUM);
        }

        // ─── Navigate to next again if possible ───
        if (await nextBtn.isVisible().catch(() => false) && !(await nextBtn.isDisabled())) {
          console.log("-> Navigating to next document...");
          await cursorClick(page, '[role="dialog"] button:has(svg.lucide-chevron-right)');
          await wait(PAUSE.LONG);
          await wait(PAUSE.MEDIUM);
        }

        // ─── Go back with previous button ───
        const prevBtn = dialog.locator('button:has(svg.lucide-chevron-left)').first();
        if (await prevBtn.isVisible().catch(() => false) && !(await prevBtn.isDisabled())) {
          console.log("-> Going back to previous document...");
          await cursorClick(page, '[role="dialog"] button:has(svg.lucide-chevron-left)');
          await wait(PAUSE.LONG);
          await wait(PAUSE.MEDIUM);
        }

        // ─── Close modal ───
        console.log("-> Closing preview modal...");
        await page.keyboard.press("Escape");
        await wait(PAUSE.SHORT);
      }
    }

    console.log("-> Upload activity log demo complete.");
    await wait(PAUSE.SHORT);
  },
};

export default demo;
