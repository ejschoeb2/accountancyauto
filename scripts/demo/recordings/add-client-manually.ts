/**
 * Recording: Add a Client Manually
 *
 * Navigate to /clients, click Add Client, fill in dialog fields
 * (name, email, type, year end, VAT), and submit.
 */

import {
  type DemoDefinition,
  login,
  navigateTo,
  cursorClick,
  cursorType,
  cursorMove,
  wait,
  PAUSE,
} from "../helpers";

const demo: DemoDefinition = {
  id: "add-client-manually",
  title: "Add a Client Manually",
  description:
    "Open the 'Add Client' dialog and fill in client details — name, email, company type, year end, VAT details.",
  tags: ["add", "create", "new", "client", "manual"],
  category: "Clients",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/clients");

    // ---- Open Add Client dialog ----
    console.log("-> Opening Add Client dialog...");
    await page.locator('button:has-text("Add Client")').first().waitFor({ state: "visible", timeout: 5000 });
    await cursorClick(page, 'button:has-text("Add Client")');
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await wait(PAUSE.MEDIUM);

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
    await wait(PAUSE.MEDIUM);

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

    // ---- Submit ----
    console.log("-> Submitting...");
    await cursorClick(page, '[role="dialog"] button:has-text("Create")');
    await wait(PAUSE.LONG);

    console.log("-> Client created successfully.");
    await wait(PAUSE.READ);
  },
};

export default demo;
