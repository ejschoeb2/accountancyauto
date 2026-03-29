/**
 * Recording: Import Clients from CSV
 *
 * Login, navigate to /clients, open the Import CSV dialog, show the upload
 * drop zone with cursor interaction, seed CSV data via sessionStorage,
 * navigate to the import page, go through column mapping → review → confirm.
 */

import {
  type DemoDefinition,
  login,
  navigateTo,
  cursorClick,
  cursorMove,
  cursorType,
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

    // ---- Show the dialog content ----
    console.log("-> Reviewing import dialog...");
    await cursorMove(page, '[role="dialog"]');
    await wait(PAUSE.READ);

    // ---- Interact with the drag-and-drop upload zone ----
    console.log("-> Showing the upload drop zone...");
    const dropZone = page.locator('[role="dialog"] .border-dashed');
    if (await dropZone.isVisible().catch(() => false)) {
      // Move cursor to the drop zone prominently
      await cursorMove(page, '[role="dialog"] .border-dashed');
      await wait(PAUSE.MEDIUM);

      // Click the drop zone to simulate file selection interaction
      await cursorClick(page, '[role="dialog"] .border-dashed');
      await wait(PAUSE.MEDIUM);
    }

    await wait(PAUSE.READ);

    // ---- Close the dialog (we'll seed data and navigate to import page) ----
    console.log("-> Closing dialog to proceed with import...");
    await page.keyboard.press("Escape");
    await wait(PAUSE.SHORT);

    // ---- Seed sessionStorage with sample CSV data (4 clients) ----
    console.log("-> Seeding CSV data and navigating to import page...");
    await page.evaluate(() => {
      const sampleData = {
        parsedData: {
          headers: ["company_name", "primary_email", "client_type", "year_end_date", "vat_registered"],
          rows: [
            { "company_name": "Ashworth & Partners Ltd", "primary_email": "info@ashworthpartners.co.uk", "client_type": "Limited Company", "year_end_date": "2026-03-31", "vat_registered": "Yes" },
            { "company_name": "Blackwood Consulting LLP", "primary_email": "admin@blackwoodllp.com", "client_type": "LLP", "year_end_date": "2026-06-30", "vat_registered": "No" },
            { "company_name": "Clearwater Properties Ltd", "primary_email": "finance@clearwater.co.uk", "client_type": "Limited Company", "year_end_date": "2026-12-31", "vat_registered": "Yes" },
            { "company_name": "Daniel Foster", "primary_email": "dan.foster@gmail.com", "client_type": "Individual", "year_end_date": "2025-04-05", "vat_registered": "No" },
          ],
          sampleRows: [
            { "company_name": "Ashworth & Partners Ltd", "primary_email": "info@ashworthpartners.co.uk", "client_type": "Limited Company", "year_end_date": "2026-03-31", "vat_registered": "Yes" },
            { "company_name": "Blackwood Consulting LLP", "primary_email": "admin@blackwoodllp.com", "client_type": "LLP", "year_end_date": "2026-06-30", "vat_registered": "No" },
            { "company_name": "Clearwater Properties Ltd", "primary_email": "finance@clearwater.co.uk", "client_type": "Limited Company", "year_end_date": "2026-12-31", "vat_registered": "Yes" },
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

    // ---- Step 1: Column Mapping ----
    console.log("-> Step 1: Reviewing column mapping...");
    const mappingHeader = page.locator('h2:has-text("Map CSV Columns")');
    if (await mappingHeader.isVisible().catch(() => false)) {
      await cursorMove(page, 'h2:has-text("Map CSV Columns")');
      await wait(PAUSE.READ);
    }

    // Show the mapping rows — they should be auto-matched
    const mappingRows = page.locator('.rounded-xl.border');
    const mappingCount = await mappingRows.count();
    if (mappingCount > 0) {
      console.log("-> Showing auto-matched columns...");
      await cursorMove(page, '.rounded-xl.border', 0);
      await wait(PAUSE.MEDIUM);

      if (mappingCount > 1) {
        await cursorMove(page, '.rounded-xl.border', 1);
        await wait(PAUSE.MEDIUM);
      }
    }

    // ---- Click "Review Data" to go to edit-data step ----
    console.log("-> Clicking Review Data to proceed...");
    const reviewDataBtn = page.locator('button:has-text("Review Data")').first();
    await reviewDataBtn.waitFor({ state: "visible", timeout: 5000 });
    await cursorClick(page, 'button:has-text("Review Data")');
    await wait(PAUSE.LONG);

    // ---- Step 2: Review/Edit Data ----
    console.log("-> Step 2: Reviewing imported data...");
    const reviewHeading = page.locator('h2:has-text("Review")').first();
    if (await reviewHeading.isVisible().catch(() => false)) {
      await cursorMove(page, 'h2:has-text("Review")');
      await wait(PAUSE.READ);
    }

    // Show the data table
    const dataTable = page.locator('table').first();
    if (await dataTable.isVisible().catch(() => false)) {
      await cursorMove(page, 'table');
      await wait(PAUSE.READ);

      // Scroll down to show all rows
      const lastRow = page.locator('table tbody tr').last();
      await lastRow.scrollIntoViewIfNeeded();
      await injectCursor(page);
      await wait(PAUSE.MEDIUM);
    }

    // ---- Click Import to actually import the clients ----
    console.log("-> Clicking Import to confirm...");
    // Button text is "Import X Clients" — match on partial text
    const importBtn = page.locator('button:has-text("Import")').last();
    if (await importBtn.isVisible().catch(() => false)) {
      await importBtn.scrollIntoViewIfNeeded();
      await injectCursor(page);
      await cursorClick(page, 'button:has-text("Import"):not(:has-text("CSV"))');
      await wait(PAUSE.LONG);
    }

    // ---- Step 3: Results ----
    console.log("-> Showing import results...");
    // Wait for the import to complete and results to appear
    const resultHeading = page.locator('h2:has-text("Import Complete")');
    await resultHeading.waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
    await wait(PAUSE.LONG);

    // Show success message
    const successText = page.locator('text=successfully').first();
    if (await successText.isVisible().catch(() => false)) {
      await cursorMove(page, 'text=successfully');
      await wait(PAUSE.READ);
    }

    // Click "Go to Clients" to finish
    const goToClientsBtn = page.locator('button:has-text("Go to Clients")').first();
    if (await goToClientsBtn.isVisible().catch(() => false)) {
      console.log("-> Clicking Go to Clients...");
      await cursorClick(page, 'button:has-text("Go to Clients")');
      await wait(PAUSE.LONG);
    }

    console.log("-> Import CSV flow complete.");
    await wait(PAUSE.SHORT);
  },
};

export default demo;
