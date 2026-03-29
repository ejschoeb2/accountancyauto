/**
 * Recording: Create a Custom Email Template
 *
 * Navigate to /templates, click Create Template, fill in the name,
 * use Insert Variable to add placeholder pills to the subject and body,
 * insert a portal link, and save the template.
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
  id: "create-email-template",
  title: "Create a Custom Email Template",
  description:
    "Create a new email template using Insert Variable to add dynamic placeholders like Client Name and Deadline, add a Portal Link, and save the template.",
  tags: [
    "template",
    "create",
    "new",
    "email",
    "custom",
    "placeholders",
    "variables",
    "portal link",
  ],
  category: "Email Templates",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/templates");

    // ---- Click Create Template button ----
    console.log("-> Clicking Create Template button...");
    const createBtn = page
      .locator('button:has-text("Create Template")')
      .first();
    await createBtn.waitFor({ state: "visible", timeout: 5000 });
    await cursorClick(page, 'button:has-text("Create Template")');
    await wait(PAUSE.LONG);

    // ---- Wait for modal ----
    console.log("-> Template editor modal opened...");
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await wait(PAUSE.MEDIUM);

    // ---- Type template name ----
    console.log("-> Entering template name...");
    await cursorType(page, '[role="dialog"] #modal-name', "Monthly VAT Reminder", {
      delay: 30,
    });
    await wait(PAUSE.MEDIUM);

    // ---- Type subject line with variables ----
    console.log("-> Entering subject line...");
    const subjectInput = page.locator('[role="dialog"] input[placeholder*="ubject"]');
    await subjectInput.waitFor({ state: "visible", timeout: 5000 });
    await cursorType(
      page,
      '[role="dialog"] input[placeholder*="ubject"]',
      "VAT Return Reminder — records needed for ",
      { delay: 25 }
    );
    await wait(PAUSE.SHORT);

    // ---- Use Insert Variable to add client_name to subject ----
    console.log("-> Using Insert Variable to add Client Name to subject...");
    // Focus the subject input first so placeholder goes into subject
    await cursorClick(page, '[role="dialog"] input[placeholder*="ubject"]');
    await wait(300);

    await cursorClick(page, '[role="dialog"] button:has-text("Insert Variable")');
    await wait(PAUSE.SHORT);

    const clientNameItem = page.locator('[role="menuitem"]:has-text("Client Name")').first();
    if (await clientNameItem.isVisible()) {
      await cursorClick(page, '[role="menuitem"]:has-text("Client Name")');
      await wait(PAUSE.MEDIUM);
    } else {
      await page.keyboard.press("Escape");
    }

    // ---- Show the subject with the inserted variable ----
    console.log("-> Subject line now has {{client_name}} variable...");
    await wait(PAUSE.READ);

    // ---- Focus the body editor and type greeting ----
    console.log("-> Composing email body...");
    const editorDiv = page.locator('[role="dialog"] .tiptap, [role="dialog"] [contenteditable="true"]').first();
    if (await editorDiv.isVisible()) {
      await cursorClick(page, '[role="dialog"] .tiptap, [role="dialog"] [contenteditable="true"]');
      await wait(PAUSE.SHORT);
      await page.keyboard.type("Dear ", { delay: 30 });
      await wait(PAUSE.SHORT);
    }

    // ---- Insert client_name variable into body ----
    console.log("-> Inserting Client Name variable into body...");
    await cursorClick(page, '[role="dialog"] button:has-text("Insert Variable")');
    await wait(PAUSE.SHORT);

    const clientNameItem2 = page.locator('[role="menuitem"]:has-text("Client Name")').first();
    if (await clientNameItem2.isVisible()) {
      await cursorClick(page, '[role="menuitem"]:has-text("Client Name")');
      await wait(PAUSE.MEDIUM);
    } else {
      await page.keyboard.press("Escape");
    }

    // ---- Continue typing body text ----
    if (await editorDiv.isVisible()) {
      await page.keyboard.type(",", { delay: 30 });
      await page.keyboard.press("Enter");
      await page.keyboard.press("Enter");
      await page.keyboard.type(
        "This is a friendly reminder that your VAT Return is due for submission by ",
        { delay: 15 }
      );
      await wait(PAUSE.SHORT);
    }

    // ---- Insert deadline variable into body ----
    console.log("-> Inserting Deadline variable...");
    await cursorClick(page, '[role="dialog"] button:has-text("Insert Variable")');
    await wait(PAUSE.SHORT);

    const deadlineItem = page.locator('[role="menuitem"]:has-text("Deadline")').first();
    if (await deadlineItem.isVisible()) {
      await cursorClick(page, '[role="menuitem"]:has-text("Deadline")');
      await wait(PAUSE.MEDIUM);
    } else {
      await page.keyboard.press("Escape");
    }

    // ---- Continue with body text ----
    if (await editorDiv.isVisible()) {
      await page.keyboard.type(". Please ensure all sales invoices, purchase receipts, and bank statements for the quarter are sent to us promptly.", { delay: 10 });
      await page.keyboard.press("Enter");
      await page.keyboard.press("Enter");
      await page.keyboard.type("You can upload your documents securely here: ", { delay: 15 });
      await wait(PAUSE.SHORT);
    }

    // ---- Insert Portal Link ----
    console.log("-> Inserting Portal Link placeholder...");
    const portalLinkBtn = page.locator('[role="dialog"] button:has-text("Insert Portal Link")').first();
    if (await portalLinkBtn.isVisible()) {
      await cursorClick(page, '[role="dialog"] button:has-text("Insert Portal Link")');
      await wait(PAUSE.MEDIUM);
    }

    // ---- Finish body ----
    if (await editorDiv.isVisible()) {
      await page.keyboard.press("Enter");
      await page.keyboard.press("Enter");
      await page.keyboard.type("Kind regards,", { delay: 20 });
      await page.keyboard.press("Enter");
    }

    // ---- Insert accountant_name variable ----
    console.log("-> Inserting Accountant Name variable...");
    await cursorClick(page, '[role="dialog"] button:has-text("Insert Variable")');
    await wait(PAUSE.SHORT);

    const accountantItem = page.locator('[role="menuitem"]:has-text("Accountant Name")').first();
    if (await accountantItem.isVisible()) {
      await cursorClick(page, '[role="menuitem"]:has-text("Accountant Name")');
      await wait(PAUSE.MEDIUM);
    } else {
      await page.keyboard.press("Escape");
    }

    // ---- Show the final result ----
    console.log("-> Showing final template with all placeholders...");
    await wait(PAUSE.MEDIUM);

    // ---- Show the portal link info banner ----
    const portalInfo = page.locator('[role="dialog"] .bg-amber-500\\/10').first();
    if (await portalInfo.isVisible()) {
      await cursorMove(page, '[role="dialog"] .bg-amber-500\\/10');
      await wait(PAUSE.MEDIUM);
    }

    // ---- Click Create to save ----
    console.log("-> Saving the template...");
    const createSaveBtn = page.locator('[role="dialog"] button:has-text("Create")').last();
    if (await createSaveBtn.isVisible()) {
      await cursorClick(page, '[role="dialog"] button:has-text("Create")');
      await wait(PAUSE.LONG);
    }

    console.log("-> Template created successfully.");
    await wait(PAUSE.READ);
  },
};

export default demo;
