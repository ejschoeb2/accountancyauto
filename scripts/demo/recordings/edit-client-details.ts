/**
 * Recording: Edit Client Details from the Detail Page
 *
 * On the client detail page, click Edit, modify the email and company name,
 * and save. Does NOT change company type (to avoid side effects on filings).
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
  injectCursor,
} from "../helpers";

const demo: DemoDefinition = {
  id: "edit-client-details",
  title: "Edit Client Details from the Detail Page",
  description:
    "Switch to edit mode on the client detail page to update the company name and email address, then save.",
  tags: ["edit", "client", "detail", "update", "profile"],
  category: "Clients",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/clients");

    // ---- Navigate to a client detail page by clicking the client name ----
    console.log("-> Clicking on a client name to open detail page...");
    await cursorClick(page, 'td:has(> span.text-muted-foreground)', 0);
    await page.waitForURL("**/clients/**", { timeout: 10000 });
    await page.waitForLoadState("networkidle");
    await injectCursor(page);
    await wait(PAUSE.LONG);

    // ---- Click Edit button ----
    console.log("-> Clicking Edit button...");
    await cursorClick(page, 'button:has-text("Edit")');
    await wait(PAUSE.MEDIUM);

    // ---- Show the edit form ----
    console.log("-> Edit mode active — form fields are editable...");
    await cursorMove(page, 'h2:has-text("Client Details")');
    await wait(PAUSE.READ);

    // ---- Update the email ----
    console.log("-> Updating email...");
    const emailInput = page.locator("#primary_email");
    if (await emailInput.isVisible().catch(() => false)) {
      await cursorClick(page, "#primary_email");
      await emailInput.fill("");
      await cursorType(page, "#primary_email", "finance@updated-domain.co.uk", {
        delay: 25,
      });
      await wait(PAUSE.MEDIUM);
    }

    // ---- Update the company name / display name ----
    console.log("-> Updating company name...");
    // The display name is editable as the h1 input when in edit mode
    const nameInput = page.locator('input.text-4xl').first();
    if (await nameInput.isVisible().catch(() => false)) {
      await cursorClick(page, 'input.text-4xl');
      const currentName = await nameInput.inputValue();
      // Append " (Updated)" to the name
      await nameInput.fill(currentName + " (Updated)");
      await wait(PAUSE.MEDIUM);
    } else {
      // Try company_name field if available
      const companyNameInput = page.locator("#company_name");
      if (await companyNameInput.isVisible().catch(() => false)) {
        await cursorClick(page, "#company_name");
        const currentName = await companyNameInput.inputValue();
        await companyNameInput.fill(currentName + " (Updated)");
        await wait(PAUSE.MEDIUM);
      }
    }

    // ---- Review changes ----
    console.log("-> Reviewing changes before saving...");
    await cursorMove(page, 'h2:has-text("Client Details")');
    await wait(PAUSE.READ);

    // ---- Save ----
    console.log("-> Saving changes...");
    await cursorClick(page, 'button:has-text("Save")');
    await wait(PAUSE.LONG);

    // Wait for save to complete (button text changes or toast appears)
    await wait(PAUSE.MEDIUM);

    console.log("-> Client details updated successfully.");
    await wait(PAUSE.READ);
  },
};

export default demo;
