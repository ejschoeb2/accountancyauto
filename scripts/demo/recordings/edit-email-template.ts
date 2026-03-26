/**
 * Recording: Edit an Existing Email Template
 *
 * Navigate to /templates, click the "Friendly First Reminder" template
 * to open the editor modal, improve the subject line, add a portal link
 * to the body, and save the changes.
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
  id: "edit-email-template",
  title: "Edit an Existing Email Template",
  description:
    "Open the Friendly First Reminder template, improve the subject line, add a portal link for document uploads, and save the changes.",
  tags: [
    "template",
    "edit",
    "modify",
    "email",
    "placeholders",
    "editor",
  ],
  category: "Email Templates",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/templates");

    // ---- Wait for templates table to load ----
    console.log("-> Waiting for templates to load...");
    await page.waitForLoadState("networkidle");
    await wait(PAUSE.MEDIUM);

    // ---- Click on the "Friendly First Reminder" template ----
    console.log("-> Clicking on 'Friendly First Reminder' template...");
    const friendlyRow = page.locator('tr:has-text("Friendly First Reminder")').first();
    if (await friendlyRow.isVisible()) {
      await cursorClick(page, 'tr:has-text("Friendly First Reminder")');
    } else {
      // Fallback: click first template row
      await cursorClick(page, "table tbody tr", 0);
    }
    await wait(PAUSE.LONG);

    // ---- Wait for editor modal ----
    console.log("-> Template editor modal opened...");
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await wait(PAUSE.MEDIUM);

    // ---- Show the Edit Template title ----
    const editTitle = page.locator('[role="dialog"]:has-text("Edit Template")').first();
    if (await editTitle.isVisible()) {
      await cursorMove(page, '[role="dialog"] h2');
      await wait(PAUSE.SHORT);
    }

    // ---- Show the "Used in" info ----
    console.log("-> Showing usage info...");
    const usedInText = page.locator('[role="dialog"]:has-text("Used in")').first();
    if (await usedInText.isVisible()) {
      await wait(PAUSE.SHORT);
    }

    // ---- Improve the subject line ----
    console.log("-> Improving subject line...");
    const subjectInput = page.locator('[role="dialog"] input[placeholder*="ubject"]');
    if (await subjectInput.isVisible()) {
      // Click on subject, go to end, add text
      await cursorClick(page, '[role="dialog"] input[placeholder*="ubject"]');
      await wait(PAUSE.SHORT);
      await page.keyboard.press("End");
      await page.keyboard.type(" — action needed", { delay: 30 });
      await wait(PAUSE.MEDIUM);
    }

    // ---- Edit the body — add a portal link section ----
    console.log("-> Adding portal link section to email body...");
    const editorDiv = page.locator('[role="dialog"] .tiptap, [role="dialog"] [contenteditable="true"]').first();
    if (await editorDiv.isVisible()) {
      await cursorClick(page, '[role="dialog"] .tiptap, [role="dialog"] [contenteditable="true"]');
      await wait(PAUSE.SHORT);

      // Move to end of the editor content
      await page.keyboard.press("Control+End");
      await page.keyboard.press("Enter");
      await page.keyboard.press("Enter");
      await page.keyboard.type(
        "You can upload your documents securely via our client portal: ",
        { delay: 15 }
      );
      await wait(PAUSE.SHORT);
    }

    // ---- Insert Portal Link placeholder ----
    console.log("-> Inserting Portal Link...");
    const portalLinkBtn = page.locator('[role="dialog"] button:has-text("Insert Portal Link")').first();
    if (await portalLinkBtn.isVisible()) {
      await cursorClick(page, '[role="dialog"] button:has-text("Insert Portal Link")');
      await wait(PAUSE.MEDIUM);
    }

    // ---- Show the updated template ----
    console.log("-> Showing the updated template...");
    await wait(PAUSE.READ);

    // ---- Click Save ----
    console.log("-> Saving changes...");
    const saveBtn = page.locator('[role="dialog"] button:has-text("Save")').first();
    if (await saveBtn.isVisible()) {
      await cursorClick(page, '[role="dialog"] button:has-text("Save")');
      await wait(PAUSE.LONG);
    }

    console.log("-> Template edited and saved successfully.");
    await wait(PAUSE.READ);
  },
};

export default demo;
