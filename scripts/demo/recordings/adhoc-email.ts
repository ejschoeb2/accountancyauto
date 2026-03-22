/**
 * Recording: Send an Ad-hoc Email
 *
 * Select clients, open the Send Email modal, configure filing type + template,
 * compose the email, and preview it (stops before actually sending).
 */

import {
  type DemoDefinition,
  login,
  navigateTo,
  cursorClick,
  cursorType,
  wait,
  PAUSE,
} from "../helpers";

const demo: DemoDefinition = {
  id: "adhoc-email",
  title: "Send an Ad-hoc Email",
  description: "Select clients from the client list and send them a custom email with filing type and template.",
  tags: ["email", "send", "ad-hoc", "clients", "bulk", "template"],
  category: "Emails",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/clients");

    // ─── Select clients ───
    console.log("→ Selecting clients...");
    const checkboxes = page.locator('table [role="checkbox"]');
    const count = await checkboxes.count();

    await cursorClick(page, 'table [role="checkbox"]', 1);
    await wait(PAUSE.SHORT);

    if (count > 2) {
      await cursorClick(page, 'table [role="checkbox"]', 2);
      await wait(PAUSE.SHORT);
    }

    if (count > 3) {
      await cursorClick(page, 'table [role="checkbox"]', 3);
      await wait(PAUSE.MEDIUM);
    }

    // ─── Open Send Email modal ───
    console.log("→ Opening Send Email modal...");
    const sendEmailBtn = page.locator('button:has-text("Send Email")').first();
    await sendEmailBtn.waitFor({ state: "visible", timeout: 5000 });
    await wait(PAUSE.SHORT);
    await cursorClick(page, 'button:has-text("Send Email")');
    await wait(PAUSE.MEDIUM);

    // ─── Configure the email ───
    console.log("→ Configuring email...");
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await wait(PAUSE.MEDIUM);

    // Select filing type
    await cursorClick(page, '[role="dialog"] [role="combobox"]', 0);
    await wait(PAUSE.SHORT);
    const filingOption = page.locator('[role="option"]').nth(1);
    await filingOption.waitFor({ state: "visible", timeout: 5000 });
    await cursorClick(page, '[role="option"]', 1);
    await wait(PAUSE.MEDIUM);

    // Select template
    await cursorClick(page, '[role="dialog"] [role="combobox"]', 1);
    await wait(PAUSE.SHORT);
    const templateOption = page.locator('[role="option"]').nth(1);
    if ((await templateOption.count()) > 0 && (await templateOption.isVisible())) {
      await cursorClick(page, '[role="option"]', 1);
      await wait(PAUSE.LONG);
    } else {
      await page.keyboard.press("Escape");
      await wait(PAUSE.SHORT);
    }

    // Type subject if empty
    const subjectInput = page.locator(
      '[role="dialog"] input[placeholder*="Subject"], [role="dialog"] input[placeholder*="subject"]'
    );
    if (await subjectInput.isVisible()) {
      const subjectValue = await subjectInput.inputValue();
      if (!subjectValue) {
        await cursorType(
          page,
          '[role="dialog"] input[placeholder*="Subject"], [role="dialog"] input[placeholder*="subject"]',
          "Important update regarding your upcoming filing deadline",
          { delay: 30 }
        );
        await wait(PAUSE.MEDIUM);
      }
    }

    // Type body if empty
    const editorDiv = page
      .locator('[role="dialog"] .tiptap, [role="dialog"] [contenteditable="true"]')
      .first();
    if (await editorDiv.isVisible()) {
      const bodyText = await editorDiv.textContent();
      if (!bodyText || bodyText.trim().length === 0) {
        await cursorType(
          page,
          '[role="dialog"] .tiptap, [role="dialog"] [contenteditable="true"]',
          "Dear {{client_name}},\n\nThis is a friendly reminder about your upcoming {{filing_type}} deadline on {{deadline}}.\n\nPlease let us know if you have any questions.\n\nKind regards",
          { delay: 20 }
        );
        await wait(PAUSE.MEDIUM);
      }
    }

    await wait(PAUSE.READ);

    // ─── Preview ───
    console.log("→ Previewing email...");
    await cursorClick(page, '[role="dialog"] button:has-text("Next")');
    await wait(PAUSE.READ);

    console.log("→ On confirm screen — pausing for viewer...");
    await wait(PAUSE.READ);
  },
};

export default demo;
