/**
 * Recording: Send Email to a Single Client
 *
 * Navigate to a client detail page, click Send Email, compose an email
 * with a filing context and template, preview it (stops before sending).
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
  id: "send-email-single-client",
  title: "Send Email to a Single Client",
  description:
    "From the client detail page, compose and send an email to one specific client.",
  tags: ["email", "send", "single", "client", "detail"],
  category: "Emails",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/clients");

    // ---- Click first client row to open detail page ----
    console.log("-> Opening a client detail page...");
    const clientRow = page.locator("table tbody tr").first();
    await clientRow.waitFor({ state: "visible", timeout: 10000 });
    await cursorClick(page, "table tbody tr td", 1);
    await page.waitForURL("**/clients/**", { timeout: 10000 });
    await page.waitForLoadState("networkidle");
    await wait(PAUSE.LONG);

    // ---- Click Send Email button ----
    console.log("-> Clicking Send Email button...");
    const sendEmailBtn = page
      .locator('button:has-text("Send Email"), a:has-text("Send Email")')
      .first();
    await sendEmailBtn.waitFor({ state: "visible", timeout: 5000 });
    await cursorClick(
      page,
      'button:has-text("Send Email"), a:has-text("Send Email")'
    );
    await wait(PAUSE.MEDIUM);

    // ---- Wait for dialog ----
    console.log("-> Composing email in Send Email modal...");
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await wait(PAUSE.MEDIUM);

    // ---- Select filing context ----
    console.log("-> Selecting filing context...");
    const filingTrigger = page
      .locator('[role="dialog"] button[role="combobox"]')
      .first();
    if (await filingTrigger.isVisible()) {
      await cursorClick(
        page,
        '[role="dialog"] button[role="combobox"]',
        0
      );
      await wait(PAUSE.SHORT);
      const filingOption = page.locator('[role="option"]').nth(1);
      if ((await filingOption.count()) > 0) {
        await cursorClick(page, '[role="option"]', 1);
        await wait(PAUSE.MEDIUM);
      } else {
        await page.keyboard.press("Escape");
        await wait(PAUSE.SHORT);
      }
    }

    // ---- Select template ----
    console.log("-> Selecting email template...");
    const templateTrigger = page
      .locator('[role="dialog"] button[role="combobox"]')
      .nth(1);
    if (await templateTrigger.isVisible()) {
      await cursorClick(
        page,
        '[role="dialog"] button[role="combobox"]',
        1
      );
      await wait(PAUSE.SHORT);
      const templateOption = page.locator('[role="option"]').nth(1);
      if (
        (await templateOption.count()) > 0 &&
        (await templateOption.isVisible())
      ) {
        await cursorClick(page, '[role="option"]', 1);
        await wait(PAUSE.LONG);
      } else {
        await page.keyboard.press("Escape");
        await wait(PAUSE.SHORT);
      }
    }

    // ---- Type subject if empty ----
    const subjectInput = page.locator(
      '[role="dialog"] input[placeholder*="Subject"], [role="dialog"] input[placeholder*="subject"]'
    );
    if ((await subjectInput.count()) > 0 && (await subjectInput.isVisible())) {
      const subjectVal = await subjectInput.inputValue();
      if (!subjectVal) {
        await cursorType(
          page,
          '[role="dialog"] input[placeholder*="Subject"], [role="dialog"] input[placeholder*="subject"]',
          "Reminder: your upcoming filing deadline",
          { delay: 30 }
        );
        await wait(PAUSE.MEDIUM);
      }
    }

    // ---- Type body if empty ----
    const editorDiv = page
      .locator(
        '[role="dialog"] .tiptap, [role="dialog"] [contenteditable="true"]'
      )
      .first();
    if ((await editorDiv.count()) > 0 && (await editorDiv.isVisible())) {
      const bodyText = await editorDiv.textContent();
      if (!bodyText || bodyText.trim().length === 0) {
        await cursorType(
          page,
          '[role="dialog"] .tiptap, [role="dialog"] [contenteditable="true"]',
          "Dear {{client_name}},\n\nThis is a reminder about your upcoming {{filing_type}} deadline on {{deadline}}.\n\nPlease get in touch if you have any questions.\n\nKind regards",
          { delay: 20 }
        );
        await wait(PAUSE.MEDIUM);
      }
    }

    await wait(PAUSE.READ);

    // ---- Click Next to preview ----
    console.log("-> Previewing email...");
    const nextBtn = page
      .locator('[role="dialog"] button:has-text("Next")')
      .first();
    if (await nextBtn.isVisible()) {
      await cursorClick(page, '[role="dialog"] button:has-text("Next")');
      await wait(PAUSE.READ);
    }

    console.log("-> On preview screen -- pausing for viewer...");
    await wait(PAUSE.READ);
  },
};

export default demo;
