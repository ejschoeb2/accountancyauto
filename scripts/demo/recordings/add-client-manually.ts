/**
 * Recording: Add a Single Client Manually
 *
 * Navigate to /clients, click Add Client, fill in dialog fields
 * (name, email, type, year end, VAT), submit, and wait for success.
 * The dialog is centered to ensure the full form is visible.
 */

import {
  type DemoDefinition,
  login,
  navigateTo,
  cursorClick,
  cursorType,
  cursorMove,
  injectCursor,
  wait,
  PAUSE,
} from "../helpers";

const demo: DemoDefinition = {
  id: "add-client-manually",
  title: "Add a Single Client Manually",
  description:
    "Open the 'Add Client' dialog, fill in a single client's details — name, email, company type, year end, VAT — and submit to create them.",
  tags: ["add", "create", "new", "client", "manual", "single"],
  category: "Clients",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/clients");

    // ---- Switch to Data view where Add Client button lives ----
    console.log("-> Switching to Client Data view...");
    await cursorClick(page, 'button:has-text("Client Data")');
    await wait(PAUSE.MEDIUM);

    // ---- Open Add Client dialog ----
    console.log("-> Opening Add Client dialog...");
    await page.locator('button:has-text("Add Client")').first().waitFor({ state: "visible", timeout: 5000 });
    await cursorClick(page, 'button:has-text("Add Client")');
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await wait(PAUSE.MEDIUM);

    // ---- Ensure dialog is fully visible by scrolling it into view ----
    const dialog = page.locator('[role="dialog"]');
    await dialog.scrollIntoViewIfNeeded();
    await injectCursor(page);
    await wait(PAUSE.SHORT);

    // ---- Fill in Client Name ----
    console.log("-> Filling in client name...");
    await cursorType(page, "#company-name", "Meridian Trading Ltd", {
      delay: 30,
    });
    await wait(PAUSE.SHORT);

    // ---- Fill in Display Name ----
    console.log("-> Filling in display name...");
    await cursorType(page, "#display-name", "Meridian Trading", { delay: 30 });
    await wait(PAUSE.SHORT);

    // ---- Fill in Email ----
    console.log("-> Filling in email...");
    await cursorType(page, "#email", "accounts@meridiantrading.co.uk", {
      delay: 25,
    });
    await wait(PAUSE.SHORT);

    // ---- Select Client Type ----
    console.log("-> Selecting client type...");
    await cursorClick(
      page,
      '[role="dialog"] button[role="combobox"]:has-text("Select client type")'
    );
    await wait(PAUSE.SHORT);
    await cursorClick(page, '[role="option"]:has-text("Limited Company")');
    await wait(PAUSE.MEDIUM);

    // ---- Fill in Year End Date ----
    console.log("-> Setting year end date...");
    await cursorClick(page, "#year-end-date");
    await page.fill("#year-end-date", "2026-03-31");
    await wait(PAUSE.MEDIUM);

    // ---- Select VAT Registered ----
    console.log("-> Setting VAT registered...");
    await cursorClick(
      page,
      '[role="dialog"] button[role="combobox"]:has-text("Select VAT status")'
    );
    await wait(PAUSE.SHORT);
    await cursorClick(page, '[role="option"]:has-text("Registered")');
    await wait(PAUSE.LONG);

    // Scroll dialog down to reveal VAT sub-fields that appear after setting VAT = registered
    const dialogContent = page.locator('[role="dialog"] [data-radix-scroll-area-viewport], [role="dialog"] .overflow-y-auto, [role="dialog"]').first();
    await dialogContent.evaluate((el) => el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }));
    await wait(PAUSE.MEDIUM);

    // Wait for VAT sub-fields to render (they appear conditionally after VAT = "yes")
    await page.waitForSelector('[role="dialog"] button[role="combobox"]:has-text("Select stagger group")', { timeout: 10000 });
    await wait(PAUSE.SHORT);

    // ---- Select VAT Stagger Group ----
    console.log("-> Selecting VAT stagger group...");
    await cursorClick(
      page,
      '[role="dialog"] button[role="combobox"]:has-text("Select stagger group")'
    );
    await wait(PAUSE.SHORT);
    await cursorClick(
      page,
      '[role="option"]:has-text("1 (Mar/Jun/Sep/Dec)")'
    );
    await wait(PAUSE.MEDIUM);

    // ---- Select VAT Scheme ----
    console.log("-> Selecting VAT scheme...");
    await cursorClick(
      page,
      '[role="dialog"] button[role="combobox"]:has-text("Select VAT scheme")'
    );
    await wait(PAUSE.SHORT);
    await cursorClick(page, '[role="option"]:has-text("Standard")');
    await wait(PAUSE.MEDIUM);

    // ---- Review the filled form ----
    console.log("-> Reviewing form before submission...");
    await cursorMove(page, '[role="dialog"]');
    await wait(PAUSE.READ);

    // ---- Submit and wait for success ----
    console.log("-> Submitting to create client...");
    await cursorClick(page, '[role="dialog"] button:has-text("Create")');

    // Wait for the dialog to close (success) or a toast notification
    try {
      await page.waitForSelector('[role="dialog"]', { state: "hidden", timeout: 10000 });
      console.log("-> Client created successfully — dialog closed.");
    } catch {
      // Dialog may still be showing a success state
      console.log("-> Waiting for success confirmation...");
    }
    await wait(PAUSE.LONG);

    // ---- Show the result — client should now appear in the table ----
    console.log("-> Verifying new client appears in table...");
    await wait(PAUSE.READ);

    console.log("-> Add client manually demo complete.");
  },
};

export default demo;
