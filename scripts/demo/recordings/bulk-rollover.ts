/**
 * Recording: Bulk Roll Over Completed Filings
 *
 * Navigate to /rollover, select multiple completed filings from the table,
 * click "Roll Over Selected" to show the confirmation dialog, then close
 * without confirming (destructive demo).
 */

import {
  type DemoDefinition,
  login,
  navigateTo,
  cursorClick,
  cursorMove,
  wait,
  PAUSE,
  BASE_URL,
} from "../helpers";

const demo: DemoDefinition = {
  id: "bulk-rollover",
  title: "Bulk Roll Over Completed Filings",
  description:
    "Use the rollover page to select multiple completed filings and roll them all to their next period at once.",
  tags: [
    "rollover",
    "bulk",
    "completed",
    "filings",
    "next period",
    "year end",
  ],
  category: "Deadlines",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await page.goto(`${BASE_URL}/rollover`);
    await page.waitForLoadState("networkidle");

    // ─── View the rollover page ───
    console.log("→ Viewing rollover candidates...");
    await page.waitForLoadState("networkidle");
    await wait(PAUSE.LONG);

    // Check if there are candidates
    const emptyState = page.locator("text=No filing obligations ready to roll over");
    if (await emptyState.isVisible()) {
      console.log("→ No rollover candidates available — showing empty state.");
      await wait(PAUSE.READ);
      return;
    }

    // ─── Wait for table to load ───
    console.log("→ Table loaded — selecting filings...");
    const tableRows = page.locator("table tbody tr");
    await tableRows.first().waitFor({ state: "visible", timeout: 10000 });
    await wait(PAUSE.MEDIUM);

    // ─── Select individual filings ───
    const checkboxes = page.locator('table tbody [role="checkbox"]');
    const checkboxCount = await checkboxes.count();

    if (checkboxCount > 0) {
      console.log("→ Selecting first filing...");
      await cursorClick(page, 'table tbody [role="checkbox"]', 0);
      await wait(PAUSE.SHORT);
    }

    if (checkboxCount > 1) {
      console.log("→ Selecting second filing...");
      await cursorClick(page, 'table tbody [role="checkbox"]', 1);
      await wait(PAUSE.SHORT);
    }

    if (checkboxCount > 2) {
      console.log("→ Selecting third filing...");
      await cursorClick(page, 'table tbody [role="checkbox"]', 2);
      await wait(PAUSE.MEDIUM);
    }

    // Or use select all if only a few
    if (checkboxCount <= 2 && checkboxCount > 0) {
      console.log("→ Selecting all via header checkbox...");
      await cursorClick(page, 'table thead [role="checkbox"]');
      await wait(PAUSE.MEDIUM);
    }

    // ─── Click Roll Over Selected button ───
    console.log("→ Clicking Roll Over Selected...");
    const rolloverBtn = page.locator('button:has-text("Roll Over Selected")');
    await rolloverBtn.waitFor({ state: "visible", timeout: 5000 });
    await cursorClick(page, 'button:has-text("Roll Over Selected")');
    await wait(PAUSE.MEDIUM);

    // ─── Confirmation dialog appears ───
    console.log("→ Confirmation dialog shown — reviewing details...");
    const dialog = page.locator('[role="alertdialog"]');
    await dialog.waitFor({ state: "visible", timeout: 5000 });
    await wait(PAUSE.READ);

    // Hover over the description to show what will happen
    await cursorMove(page, '[role="alertdialog"] p');
    await wait(PAUSE.READ);

    // ─── Close without confirming (destructive demo) ───
    console.log("→ Cancelling — not confirming rollover (demo)...");
    await cursorClick(page, '[role="alertdialog"] button:has-text("Cancel")');
    await wait(PAUSE.MEDIUM);

    console.log("→ Bulk rollover demo complete.");
  },
};

export default demo;
