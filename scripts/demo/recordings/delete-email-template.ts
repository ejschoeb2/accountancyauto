/**
 * Recording: Delete an Email Template
 *
 * Navigate to /templates, click the delete button on a template row
 * to show the browser confirmation dialog. Stops before confirming.
 * Alternatively, opens the editor and clicks the Delete button there.
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
  id: "delete-email-template",
  title: "Delete an Email Template",
  description:
    "Remove a custom email template that is no longer needed.",
  tags: ["template", "delete", "remove", "email"],
  category: "Email Templates",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/templates");

    // ---- Wait for templates to load ----
    console.log("-> Waiting for templates to load...");
    await page.waitForLoadState("networkidle");
    await wait(PAUSE.MEDIUM);

    // ---- Browse the templates table ----
    console.log("-> Browsing templates...");
    const templateRows = page.locator("table tbody tr, tbody tr.cursor-pointer");
    const rowCount = await templateRows.count();

    if (rowCount === 0) {
      console.log("-> No templates found, ending demo...");
      await wait(PAUSE.READ);
      return;
    }

    // ---- Show the delete button on the first row ----
    console.log("-> Hovering over template row to reveal delete button...");
    await cursorMove(page, "table tbody tr, tbody tr.cursor-pointer", 0);
    await wait(PAUSE.SHORT);

    // ---- Open the template editor to use the Delete button there ----
    console.log("-> Opening template editor to show delete option...");
    await cursorClick(page, "table tbody tr, tbody tr.cursor-pointer", 0);
    await wait(PAUSE.MEDIUM);

    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await wait(PAUSE.MEDIUM);

    // ---- Click the Delete button in the editor modal ----
    console.log("-> Clicking Delete button in template editor...");
    const deleteBtn = page
      .locator('[role="dialog"] button:has-text("Delete")')
      .first();
    if (await deleteBtn.isVisible()) {
      await cursorClick(page, '[role="dialog"] button:has-text("Delete")');
      await wait(PAUSE.MEDIUM);

      // ---- Wait for the delete confirmation dialog ----
      console.log("-> Delete confirmation dialog shown...");
      // The second dialog (delete confirmation) should appear
      const confirmDialog = page.locator('[role="dialog"]:has-text("Delete Template")');
      await confirmDialog.waitFor({ state: "visible", timeout: 5000 });
      await wait(PAUSE.MEDIUM);

      // ---- Show the confirmation message ----
      const confirmText = page
        .locator(
          '[role="dialog"] p:has-text("Are you sure"), [role="dialog"]:has-text("cannot be undone")'
        )
        .first();
      if (await confirmText.isVisible()) {
        await cursorMove(
          page,
          '[role="dialog"] p:has-text("Are you sure"), [role="dialog"]:has-text("cannot be undone")'
        );
        await wait(PAUSE.READ);
      }

      // ---- Hover over the Delete confirmation button but DON'T click ----
      console.log("-> Showing destructive Delete button (not clicking)...");
      const confirmDeleteBtn = page
        .locator('[role="dialog"] button:has-text("Delete"):not(:has-text("Template"))')
        .last();
      if (await confirmDeleteBtn.isVisible()) {
        await cursorMove(
          page,
          '[role="dialog"] button.bg-destructive, [role="dialog"] button[variant="destructive"]'
        );
        await wait(PAUSE.MEDIUM);
      }

      // ---- Dismiss confirmation dialog ----
      console.log("-> Pressing Escape to dismiss confirmation...");
      await page.keyboard.press('Escape');
      await wait(PAUSE.SHORT);
    }

    console.log(
      "-> Template deletion demo complete -- pausing for viewer..."
    );
    await wait(PAUSE.READ);
  },
};

export default demo;
