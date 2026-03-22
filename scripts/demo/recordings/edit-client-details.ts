/**
 * Recording: Edit Client Details from the Detail Page
 *
 * On the client detail page, click Edit, modify fields (company type,
 * email), and save.
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
  id: "edit-client-details",
  title: "Edit Client Details from the Detail Page",
  description:
    "Switch to edit mode on the client detail page to update name, email, company type, VAT scheme, and other fields.",
  tags: ["edit", "client", "detail", "update", "profile"],
  category: "Clients",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/clients");

    // ---- Navigate to a client detail page ----
    console.log("-> Clicking on a client row...");
    await cursorClick(page, "table tbody tr", 0);
    await page.waitForURL("**/clients/**", { timeout: 10000 });
    await page.waitForLoadState("networkidle");
    await wait(PAUSE.LONG);

    // ---- Click Edit button ----
    console.log("-> Clicking Edit button...");
    await cursorClick(page, 'button:has-text("Edit")');
    await wait(PAUSE.MEDIUM);

    // ---- Show the edit form ----
    console.log("-> Edit mode active — form fields are editable...");
    await cursorMove(page, 'h2:has-text("Client Details")');
    await wait(PAUSE.MEDIUM);

    // ---- Change the Company Type ----
    console.log("-> Changing company type...");
    const companyTypeSelect = page.locator("#client_type");
    if (await companyTypeSelect.isVisible()) {
      await cursorClick(page, "#client_type");
      await wait(PAUSE.SHORT);
      await cursorClick(page, '[role="option"]:has-text("LLP")');
      await wait(PAUSE.MEDIUM);
    }

    // ---- Update the email ----
    console.log("-> Updating email...");
    const emailInput = page.locator("#primary_email");
    if (await emailInput.isVisible()) {
      await cursorClick(page, "#primary_email");
      await emailInput.fill("");
      await cursorType(page, "#primary_email", "updated@example.co.uk", {
        delay: 25,
      });
      await wait(PAUSE.MEDIUM);
    }

    // ---- Review changes ----
    console.log("-> Reviewing changes before saving...");
    await cursorMove(page, 'h2:has-text("Client Details")');
    await wait(PAUSE.READ);

    // ---- Save ----
    console.log("-> Saving changes...");
    await cursorClick(page, 'button:has-text("Save")');
    await wait(PAUSE.LONG);

    console.log("-> Client details updated successfully.");
    await wait(PAUSE.READ);
  },
};

export default demo;
