/**
 * Recording: Import Clients from CSV
 *
 * Navigate to /clients, click Import CSV, interact with the CSV dialog,
 * download the template, and show the drop zone.
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
  id: "import-clients-csv",
  title: "Import Clients from CSV",
  description:
    "Upload a CSV file to bulk-import clients — map columns, review the preview, and confirm the import.",
  tags: ["import", "csv", "bulk", "upload", "clients", "spreadsheet"],
  category: "Clients",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/clients");

    // ---- Open Import CSV dialog ----
    console.log("-> Opening Import CSV dialog...");
    await page.locator('button:has-text("Import CSV")').first().waitFor({ state: "visible", timeout: 5000 });
    await cursorClick(page, 'button:has-text("Import CSV")');
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await wait(PAUSE.MEDIUM);

    // ---- Show the dialog content ----
    console.log("-> Reviewing import dialog — required and optional fields...");
    await cursorMove(page, '[role="dialog"]');
    await wait(PAUSE.READ);

    // ---- Highlight the Download Template button ----
    console.log("-> Downloading CSV template...");
    await cursorClick(page, '[role="dialog"] button:has-text("Download template")');
    await wait(PAUSE.MEDIUM);

    // ---- Show the drag-and-drop zone ----
    console.log("-> Showing the upload drop zone...");
    await cursorMove(page, '[role="dialog"] .border-dashed');
    await wait(PAUSE.READ);

    // ---- Close the dialog ----
    console.log("-> Closing import dialog...");
    await cursorClick(page, '[role="dialog"] button:has-text("Close")');
    await wait(PAUSE.MEDIUM);

    console.log("-> Import dialog tour complete.");
    await wait(PAUSE.SHORT);
  },
};

export default demo;
