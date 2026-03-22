/**
 * Recording: Import Clients from CSV
 *
 * Login, navigate to /clients, open the Import CSV dialog, download the
 * template, show the drag-and-drop zone, then navigate directly to the
 * /clients/import page to showcase the column-mapping step UI.
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
  BASE_URL,
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

    // ---- Switch to Data view (Import CSV button is only in data view) ----
    console.log("-> Switching to Client Data view...");
    await cursorClick(page, 'button:has-text("Client Data")');
    await wait(PAUSE.MEDIUM);

    // ---- Open Import CSV dialog ----
    console.log("-> Opening Import CSV dialog...");
    await page.locator('button:has-text("Import CSV")').first().waitFor({ state: "visible", timeout: 5000 });
    await cursorClick(page, 'button:has-text("Import CSV")');
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await wait(PAUSE.MEDIUM);

    // ---- Show the dialog content — required and optional fields ----
    console.log("-> Reviewing import dialog — required and optional fields...");
    await cursorMove(page, '[role="dialog"]');
    await wait(PAUSE.READ);

    // ---- Click Download Template button ----
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

    // ---- Navigate to the import page to show column mapping UI ----
    // Seed sessionStorage with fake parsed CSV data so the import page renders
    console.log("-> Navigating to import page with sample data...");
    await page.evaluate(() => {
      const sampleData = {
        parsedData: {
          headers: ["Company Name", "Email", "Client Type", "Year End Date", "VAT Registered"],
          rows: [
            { "Company Name": "Acme Ltd", "Email": "acme@example.com", "Client Type": "Limited Company", "Year End Date": "2026-03-31", "VAT Registered": "Yes" },
            { "Company Name": "Baker & Sons", "Email": "baker@example.com", "Client Type": "Partnership", "Year End Date": "2026-06-30", "VAT Registered": "No" },
            { "Company Name": "Clark Consulting", "Email": "clark@example.com", "Client Type": "Individual", "Year End Date": "2026-04-05", "VAT Registered": "No" },
          ],
          sampleRows: [
            { "Company Name": "Acme Ltd", "Email": "acme@example.com", "Client Type": "Limited Company", "Year End Date": "2026-03-31", "VAT Registered": "Yes" },
            { "Company Name": "Baker & Sons", "Email": "baker@example.com", "Client Type": "Partnership", "Year End Date": "2026-06-30", "VAT Registered": "No" },
            { "Company Name": "Clark Consulting", "Email": "clark@example.com", "Client Type": "Individual", "Year End Date": "2026-04-05", "VAT Registered": "No" },
          ],
        },
        clientLimit: null,
        currentClientCount: 0,
      };
      sessionStorage.setItem("csv-import-data", JSON.stringify(sampleData));
    });

    await page.goto(`${BASE_URL}/clients/import`);
    await page.waitForLoadState("networkidle");
    await injectCursor(page);
    await wait(PAUSE.LONG);

    // ---- Show the column mapping step ----
    console.log("-> Reviewing column mapping step...");
    await cursorMove(page, 'h2:has-text("Map CSV Columns")');
    await wait(PAUSE.READ);

    // ---- Hover over a mapping row to show the select dropdowns ----
    console.log("-> Showing column mapping selectors...");
    // Hover over the first mapping row
    const firstMappingRow = page.locator('.rounded-xl.border').first();
    if (await firstMappingRow.isVisible()) {
      await cursorMove(page, '.rounded-xl.border');
      await wait(PAUSE.MEDIUM);
    }

    // ---- Show sample values preview ----
    console.log("-> Reviewing sample data preview in mapping...");
    await cursorMove(page, '.rounded-xl.border', 1);
    await wait(PAUSE.READ);

    // ---- Click Continue to show the edit-data step ----
    console.log("-> Clicking Continue to review data...");
    const continueBtn = page.locator('button:has-text("Continue")').first();
    if (await continueBtn.isVisible()) {
      await cursorClick(page, 'button:has-text("Continue")');
      await wait(PAUSE.LONG);

      // ---- Show the review/edit data table ----
      console.log("-> Reviewing imported data before confirmation...");
      const reviewHeading = page.locator('h2:has-text("Review")').first();
      if (await reviewHeading.isVisible()) {
        await cursorMove(page, 'h2:has-text("Review")');
        await wait(PAUSE.READ);

        // Show the data table
        await cursorMove(page, 'table');
        await wait(PAUSE.READ);

        // Show the Import button at the bottom
        const importBtn = page.locator('button:has-text("Import")').last();
        if (await importBtn.isVisible()) {
          console.log("-> Showing Import button...");
          await cursorMove(page, 'button:has-text("Import")', -1);
          await wait(PAUSE.MEDIUM);
        }
      }
    }

    // ---- Navigate back to clients ----
    console.log("-> Returning to clients page...");
    const backBtn = page.locator('button:has-text("Back")').first();
    if (await backBtn.isVisible()) {
      await cursorClick(page, 'button:has-text("Back")');
      await wait(PAUSE.MEDIUM);
    }

    console.log("-> Import CSV flow tour complete.");
    await wait(PAUSE.SHORT);
  },
};

export default demo;
