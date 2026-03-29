/**
 * Recording: Edit an Existing Email Template
 *
 * Navigate to /templates, click the "Friendly First Reminder" template
 * to open the editor modal, improve the subject line to be more personal,
 * add a line to the body about the upload portal, and save.
 *
 * The seeded "Friendly First Reminder" template has:
 *   Subject: "{{filing_type}} — deadline approaching for {{client_name}}"
 *   Body: Greeting with client_name, paragraph about records being due by
 *         deadline date, and sign-off with accountant_name.
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
} from "../helpers";

const demo: DemoDefinition = {
  id: "edit-email-template",
  title: "Edit an Existing Email Template",
  description:
    "Open the Friendly First Reminder template, improve the subject line, refine the body content, and save the changes.",
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

    // ---- Wait for templates to load ----
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

    // ---- Read the current subject line to show it ----
    console.log("-> Viewing current subject line...");
    const subjectInput = page.locator('[role="dialog"] input[placeholder*="ubject"]');
    if (await subjectInput.isVisible()) {
      await cursorMove(page, '[role="dialog"] input[placeholder*="ubject"]');
      await wait(PAUSE.READ);

      // ---- Clear and rewrite the subject to something more personal ----
      // Current: "{{filing_type}} — deadline approaching for {{client_name}}"
      // New: "Friendly reminder: your {{filing_type}} is due soon"
      console.log("-> Improving subject line...");
      await cursorClick(page, '[role="dialog"] input[placeholder*="ubject"]');
      await wait(PAUSE.SHORT);

      // Select all existing text
      await page.keyboard.press("Control+A");
      await wait(300);

      // Type the new, cleaner subject
      await page.keyboard.type("Friendly reminder: your ", { delay: 25 });
      await wait(PAUSE.SHORT);

      // Insert filing_type variable via the Insert Variable button
      await cursorClick(page, '[role="dialog"] button:has-text("Insert Variable")');
      await wait(PAUSE.SHORT);
      const filingTypeItem = page.locator('[role="menuitem"]:has-text("Filing Type")').first();
      if (await filingTypeItem.isVisible()) {
        await cursorClick(page, '[role="menuitem"]:has-text("Filing Type")');
      } else {
        await page.keyboard.press("Escape");
      }
      await wait(PAUSE.SHORT);

      // Continue typing after the variable
      await cursorClick(page, '[role="dialog"] input[placeholder*="ubject"]');
      await page.keyboard.press("End");
      await page.keyboard.type(" is due soon", { delay: 25 });
      await wait(PAUSE.MEDIUM);
    }

    // ---- Show the body content ----
    console.log("-> Viewing email body...");
    const editorDiv = page.locator('[role="dialog"] .tiptap, [role="dialog"] [contenteditable="true"]').first();
    if (await editorDiv.isVisible()) {
      await cursorClick(page, '[role="dialog"] .tiptap, [role="dialog"] [contenteditable="true"]');
      await wait(PAUSE.MEDIUM);

      // Navigate to end of the body to add a new paragraph about the portal
      console.log("-> Adding a line about the upload portal...");
      await page.keyboard.press("Control+End");
      await wait(PAUSE.SHORT);

      // Move up before the sign-off to insert a new paragraph
      await page.keyboard.press("Enter");
      await page.keyboard.press("Enter");
      await page.keyboard.type(
        "You can also upload your documents securely using your personalised portal link — no login required.",
        { delay: 20 }
      );
      await wait(PAUSE.READ);
    }

    // ---- Show the updated template ----
    console.log("-> Reviewing updated template...");
    // Scroll up in the editor to see the full template
    await cursorMove(page, '[role="dialog"] input[placeholder*="ubject"]');
    await wait(PAUSE.READ);

    // ---- Click Save ----
    console.log("-> Saving changes...");
    const saveBtn = page.locator('[role="dialog"] button:has-text("Save")').first();
    if (await saveBtn.isVisible()) {
      await cursorClick(page, '[role="dialog"] button:has-text("Save")');
      await wait(PAUSE.LONG);
    }

    console.log("-> Template edited and saved successfully.");
    await wait(PAUSE.MEDIUM);
  },
};

export default demo;
