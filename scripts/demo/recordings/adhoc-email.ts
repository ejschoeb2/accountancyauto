/**
 * Recording: Send an Ad-hoc Email
 *
 * Select clients, open the Send Email modal, configure filing type + template,
 * show how variables update for different selected clients, then actually send.
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
  id: "adhoc-email",
  title: "Send an Ad-hoc Email to Multiple Clients",
  description:
    "Select clients from the client list, choose a filing context and email template, preview the personalised email, and send it.",
  tags: ["email", "send", "ad-hoc", "clients", "bulk", "template"],
  category: "Emails",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/clients");

    // ─── Select three clients ───
    console.log("-> Selecting clients...");
    const checkboxes = page.locator('table tbody tr [role="checkbox"]');
    await checkboxes.first().waitFor({ state: "visible", timeout: 10000 });
    const count = await checkboxes.count();

    // Select first client
    await cursorClick(page, 'table tbody tr [role="checkbox"]', 0);
    await wait(PAUSE.SHORT);

    // Select second client
    if (count > 1) {
      await cursorClick(page, 'table tbody tr [role="checkbox"]', 1);
      await wait(PAUSE.SHORT);
    }

    // Select third client
    if (count > 2) {
      await cursorClick(page, 'table tbody tr [role="checkbox"]', 2);
      await wait(PAUSE.MEDIUM);
    }

    // ─── Open Send Email modal from bulk actions ───
    console.log("-> Opening Send Email modal...");
    const sendEmailBtn = page.locator('button:has-text("Send Email")').first();
    await sendEmailBtn.waitFor({ state: "visible", timeout: 5000 });
    await cursorClick(page, 'button:has-text("Send Email")');
    await wait(PAUSE.LONG);

    // ─── Wait for dialog ───
    console.log("-> Send Email modal opened...");
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await wait(PAUSE.MEDIUM);

    // ─── Select filing context ───
    console.log("-> Selecting filing context...");
    // The filing context is a Select component
    const filingSelect = page.locator('[role="dialog"] .space-y-2 button[role="combobox"], [role="dialog"] [data-slot="select-trigger"]').first();
    if (await filingSelect.isVisible()) {
      await cursorClick(page, '[role="dialog"] [data-slot="select-trigger"]', 0);
      await wait(PAUSE.SHORT);

      // Select "Corporation Tax Payment" from the dropdown
      const corpTaxOption = page.locator('[role="option"]:has-text("Corporation Tax")').first();
      if (await corpTaxOption.isVisible()) {
        await cursorClick(page, '[role="option"]:has-text("Corporation Tax")');
      } else {
        // Fall back to picking second option (first is "None")
        await cursorClick(page, '[role="option"]', 1);
      }
      await wait(PAUSE.LONG);
    }

    // ─── Show the green portal link confirmation ───
    console.log("-> Filing context selected — showing portal link confirmation...");
    const portalConfirm = page.locator('[role="dialog"] .bg-green-500\\/10').first();
    if (await portalConfirm.isVisible()) {
      await cursorMove(page, '[role="dialog"] .bg-green-500\\/10');
      await wait(PAUSE.READ);
    }

    // ─── Select email template ───
    console.log("-> Selecting email template...");
    const templateSelect = page.locator('[role="dialog"] [data-slot="select-trigger"]').nth(1);
    if (await templateSelect.isVisible()) {
      await cursorClick(page, '[role="dialog"] [data-slot="select-trigger"]', 1);
      await wait(PAUSE.SHORT);

      // Select "Friendly First Reminder" template
      const friendlyOption = page.locator('[role="option"]:has-text("Friendly First Reminder")').first();
      if (await friendlyOption.isVisible()) {
        await cursorClick(page, '[role="option"]:has-text("Friendly First Reminder")');
      } else {
        // Fall back to first real template (skip "No template")
        await cursorClick(page, '[role="option"]', 1);
      }
      await wait(PAUSE.LONG);
    }

    // ─── Show the populated email editor with template content ───
    console.log("-> Template loaded — reviewing email content...");
    await wait(PAUSE.READ);

    // ─── Hover over the subject to show variables in context ───
    const subjectInput = page.locator('[role="dialog"] input[placeholder*="ubject"]').first();
    if (await subjectInput.isVisible()) {
      await cursorMove(page, '[role="dialog"] input[placeholder*="ubject"]');
      await wait(PAUSE.MEDIUM);
    }

    // ─── Hover over the body editor to show placeholder pills ───
    const editorDiv = page.locator('[role="dialog"] .tiptap, [role="dialog"] [contenteditable="true"]').first();
    if (await editorDiv.isVisible()) {
      await cursorMove(page, '[role="dialog"] .tiptap, [role="dialog"] [contenteditable="true"]');
      await wait(PAUSE.READ);
    }

    // ─── Click Next to proceed to preview ───
    console.log("-> Clicking Next to preview...");
    await cursorClick(page, '[role="dialog"] button:has-text("Next")');
    await wait(PAUSE.LONG);

    // ─── Preview screen — show personalised email ───
    console.log("-> On Preview & Confirm screen...");
    await wait(PAUSE.READ);

    // ─── Click Send ───
    console.log("-> Sending emails...");
    const sendBtn = page.locator('[role="dialog"] button:has-text("Send to")').first();
    if (await sendBtn.isVisible()) {
      await cursorClick(page, '[role="dialog"] button:has-text("Send to")');
      await wait(PAUSE.LONG);
    }

    // ─── Wait for sending to complete ───
    console.log("-> Waiting for emails to be sent...");
    // Wait for the results screen (shows "Send Complete")
    const resultsTitle = page.locator('[role="dialog"]:has-text("Send Complete")');
    try {
      await resultsTitle.waitFor({ state: "visible", timeout: 30000 });
    } catch {
      // If it takes too long, just wait
      await wait(5000);
    }
    await wait(PAUSE.READ);

    // ─── Show the results summary ───
    console.log("-> Showing send results...");
    await wait(PAUSE.READ);

    // ─── Close the modal ───
    console.log("-> Closing modal...");
    const doneBtn = page.locator('[role="dialog"] button:has-text("Done")').first();
    if (await doneBtn.isVisible()) {
      await cursorClick(page, '[role="dialog"] button:has-text("Done")');
    } else {
      await page.keyboard.press("Escape");
    }
    await wait(PAUSE.MEDIUM);

    console.log("-> Ad-hoc email demo complete.");
  },
};

export default demo;
