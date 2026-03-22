/**
 * Recording: Bulk Update Filing Status
 *
 * Select multiple clients, show the status view, enter deadline edit mode,
 * and demonstrate toggling filing statuses for multiple clients.
 *
 * Note: The BulkEditStatusModal is a standalone component used on the import
 * page. This demo shows the equivalent flow using the client table's
 * deadline/status view and edit progress mode.
 */

import {
  type DemoDefinition,
  login,
  navigateTo,
  cursorClick,
  cursorMove,
  wait,
  PAUSE,
} from "../helpers";

const demo: DemoDefinition = {
  id: "bulk-edit-filing-status",
  title: "Bulk Update Filing Status",
  description:
    "Select multiple clients and mark records as received or filings as completed in bulk.",
  tags: ["bulk", "status", "received", "completed", "filing", "clients"],
  category: "Clients",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/clients");

    // ---- The client table should already be in status view by default ----
    console.log("-> Viewing client table in status view...");
    await cursorMove(page, "table");
    await wait(PAUSE.MEDIUM);

    // ---- Show the status columns with traffic light badges ----
    console.log("-> Reviewing filing status columns...");
    await cursorMove(page, "table thead");
    await wait(PAUSE.READ);

    // ---- Select multiple clients ----
    console.log("-> Selecting clients for bulk status update...");
    const checkboxes = page.locator('table [role="checkbox"]');
    const count = await checkboxes.count();

    if (count > 1) {
      await cursorClick(page, 'table [role="checkbox"]', 1);
      await wait(PAUSE.SHORT);
    }
    if (count > 2) {
      await cursorClick(page, 'table [role="checkbox"]', 2);
      await wait(PAUSE.SHORT);
    }
    if (count > 3) {
      await cursorClick(page, 'table [role="checkbox"]', 3);
      await wait(PAUSE.MEDIUM);
    }

    // ---- Show bulk actions toolbar ----
    console.log("-> Bulk actions toolbar visible with selected clients...");
    const selectedText = page.locator('text="selected"').first();
    if (await selectedText.isVisible()) {
      await cursorMove(page, 'text="selected"');
      await wait(PAUSE.READ);
    }

    // ---- Clear selection and show the status-level editing ----
    console.log("-> Clearing selection to show status column interactions...");
    const closeBtn = page.locator('button:has-text("Close")').first();
    if (await closeBtn.isVisible()) {
      await cursorClick(page, 'button:has-text("Close")');
      await wait(PAUSE.SHORT);
    }

    // ---- Show individual status badges in the table ----
    console.log("-> Reviewing individual filing status badges...");
    const statusBadge = page.locator("table tbody td .rounded-md").first();
    if (await statusBadge.isVisible()) {
      await cursorMove(page, "table tbody td .rounded-md");
      await wait(PAUSE.READ);
    }

    // ---- Navigate to a client to show per-filing status controls ----
    console.log("-> Opening a client to show per-filing status controls...");
    await cursorClick(page, "table tbody tr", 0);
    await page.waitForURL("**/clients/**", { timeout: 10000 });
    await page.waitForLoadState("networkidle");
    await wait(PAUSE.LONG);

    // ---- Show filing cards with status checkboxes ----
    console.log("-> Showing filing management with status toggles...");
    const filingSection = page.locator('h2:has-text("Filing Management")');
    await filingSection.scrollIntoViewIfNeeded();
    await cursorMove(page, 'h2:has-text("Filing Management")');
    await wait(PAUSE.READ);

    console.log("-> Bulk edit filing status demo complete.");
    await wait(PAUSE.SHORT);
  },
};

export default demo;
