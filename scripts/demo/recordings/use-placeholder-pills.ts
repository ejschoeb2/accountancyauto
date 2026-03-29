/**
 * Recording: Use Placeholder Pills in Templates
 *
 * Create a new email template from scratch, demonstrating how to insert
 * placeholder pills (Client Name, Filing Type, Deadline, Days Until Deadline)
 * into the subject line and body to build a natural, personalised email.
 *
 * Uses the "Create Template" flow so pills are inserted into meaningful
 * positions within fresh content.
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
  id: "use-placeholder-pills",
  title: "Use Placeholder Pills in Templates",
  description:
    "Insert dynamic placeholders like Client Name, Deadline, Filing Type, and Days Until Deadline into an email template. Shows how Insert Variable adds inline placeholder pills.",
  tags: [
    "placeholders",
    "pills",
    "dynamic",
    "template",
    "merge fields",
    "variables",
  ],
  category: "Email Templates",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/templates");

    // ---- Click Create Template ----
    console.log("-> Clicking Create Template...");
    await cursorClick(page, 'button:has-text("Create Template"), a:has-text("Create Template")');
    await wait(PAUSE.LONG);
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await wait(PAUSE.MEDIUM);

    // ---- Enter template name ----
    console.log("-> Entering template name...");
    const nameInput = page.locator('[role="dialog"] input').first();
    if (await nameInput.isVisible()) {
      await cursorClick(page, '[role="dialog"] input');
      await page.keyboard.type("Gentle Deadline Nudge", { delay: 25 });
      await wait(PAUSE.MEDIUM);
    }

    // ---- Build the subject line with pills ----
    console.log("-> Building subject line with placeholders...");
    const subjectInput = page.locator('[role="dialog"] input[placeholder*="ubject"]');
    if (await subjectInput.isVisible()) {
      await cursorClick(page, '[role="dialog"] input[placeholder*="ubject"]');
      await page.keyboard.type("Reminder: your ", { delay: 25 });
      await wait(PAUSE.SHORT);

      // Insert Filing Type pill
      console.log("-> Inserting Filing Type into subject...");
      await cursorClick(page, '[role="dialog"] button:has-text("Insert Variable")');
      await wait(PAUSE.SHORT);
      const filingTypeItem = page.locator('[role="menuitem"]:has-text("Filing Type")').first();
      if (await filingTypeItem.isVisible()) {
        await cursorClick(page, '[role="menuitem"]:has-text("Filing Type")');
      } else {
        await page.keyboard.press("Escape");
      }
      await wait(PAUSE.SHORT);

      // Continue typing
      await cursorClick(page, '[role="dialog"] input[placeholder*="ubject"]');
      await page.keyboard.press("End");
      await page.keyboard.type(" is due soon", { delay: 25 });
      await wait(PAUSE.MEDIUM);
    }

    // ---- Build the body with pills ----
    console.log("-> Building email body with placeholders...");
    const editorDiv = page.locator('[role="dialog"] .tiptap, [role="dialog"] [contenteditable="true"]').first();
    if (await editorDiv.isVisible()) {
      await cursorClick(page, '[role="dialog"] .tiptap, [role="dialog"] [contenteditable="true"]');
      await wait(PAUSE.SHORT);

      // Type greeting with Client Name pill
      await page.keyboard.type("Dear ", { delay: 25 });

      console.log("-> Inserting Client Name into body...");
      await cursorClick(page, '[role="dialog"] button:has-text("Insert Variable")');
      await wait(PAUSE.SHORT);
      const clientNameItem = page.locator('[role="menuitem"]:has-text("Client Name")').first();
      if (await clientNameItem.isVisible()) {
        await cursorClick(page, '[role="menuitem"]:has-text("Client Name")');
      } else {
        await page.keyboard.press("Escape");
      }
      await wait(PAUSE.SHORT);

      // Continue with body text
      await cursorClick(page, '[role="dialog"] .tiptap, [role="dialog"] [contenteditable="true"]');
      await page.keyboard.type(",", { delay: 25 });
      await page.keyboard.press("Enter");
      await page.keyboard.press("Enter");
      await page.keyboard.type("Just a quick reminder that your ", { delay: 20 });

      // Insert Filing Type pill
      console.log("-> Inserting Filing Type into body...");
      await cursorClick(page, '[role="dialog"] button:has-text("Insert Variable")');
      await wait(PAUSE.SHORT);
      const filingTypeItem2 = page.locator('[role="menuitem"]:has-text("Filing Type")').first();
      if (await filingTypeItem2.isVisible()) {
        await cursorClick(page, '[role="menuitem"]:has-text("Filing Type")');
      } else {
        await page.keyboard.press("Escape");
      }
      await wait(PAUSE.SHORT);

      await cursorClick(page, '[role="dialog"] .tiptap, [role="dialog"] [contenteditable="true"]');
      await page.keyboard.type(" deadline is coming up on ", { delay: 20 });

      // Insert Deadline pill
      console.log("-> Inserting Deadline into body...");
      await cursorClick(page, '[role="dialog"] button:has-text("Insert Variable")');
      await wait(PAUSE.SHORT);
      const deadlineItem = page.locator('[role="menuitem"]:has-text("Deadline")').first();
      if (await deadlineItem.isVisible()) {
        await cursorClick(page, '[role="menuitem"]:has-text("Deadline")');
      } else {
        await page.keyboard.press("Escape");
      }
      await wait(PAUSE.SHORT);

      await cursorClick(page, '[role="dialog"] .tiptap, [role="dialog"] [contenteditable="true"]');
      await page.keyboard.type(". That's only ", { delay: 20 });

      // Insert Days Until Deadline pill
      console.log("-> Inserting Days Until Deadline into body...");
      await cursorClick(page, '[role="dialog"] button:has-text("Insert Variable")');
      await wait(PAUSE.SHORT);
      const daysItem = page.locator('[role="menuitem"]:has-text("Days Until Deadline")').first();
      if (await daysItem.isVisible()) {
        await cursorClick(page, '[role="menuitem"]:has-text("Days Until Deadline")');
      } else {
        await page.keyboard.press("Escape");
      }
      await wait(PAUSE.SHORT);

      await cursorClick(page, '[role="dialog"] .tiptap, [role="dialog"] [contenteditable="true"]');
      await page.keyboard.type(" days away.", { delay: 20 });
      await wait(PAUSE.MEDIUM);
    }

    // ---- Show the final result with all pills visible ----
    console.log("-> Reviewing template with placeholder pills...");
    await cursorMove(page, '[role="dialog"] input[placeholder*="ubject"]');
    await wait(PAUSE.READ);

    if (await editorDiv.isVisible()) {
      await cursorMove(page, '[role="dialog"] .tiptap, [role="dialog"] [contenteditable="true"]');
      await wait(PAUSE.READ);
    }

    // ---- Save ----
    console.log("-> Saving template...");
    const saveBtn = page.locator('[role="dialog"] button:has-text("Create"), [role="dialog"] button:has-text("Save")').first();
    if (await saveBtn.isVisible()) {
      await cursorClick(page, '[role="dialog"] button:has-text("Create"), [role="dialog"] button:has-text("Save")');
      await wait(PAUSE.LONG);
    }

    console.log("-> Placeholder pills demo complete.");
    await wait(PAUSE.SHORT);
  },
};

export default demo;
