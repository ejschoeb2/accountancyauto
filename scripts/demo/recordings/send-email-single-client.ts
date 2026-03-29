/**
 * Recording: Send Email to a Single Client
 *
 * Navigate to a client detail page, click Send Email, select a filing
 * context and template, preview the personalised email, and send it.
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
  id: "send-email-single-client",
  title: "Send Email to a Single Client",
  description:
    "From the client detail page, compose and send an email to one specific client with personalised filing details.",
  tags: ["email", "send", "single", "client", "detail"],
  category: "Emails",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/clients");

    // ---- Click a client row to open detail page ----
    console.log("-> Opening client detail page...");
    // Click on the client name cell (second column) of first row
    const clientRow = page.locator("table tbody tr").first();
    await clientRow.waitFor({ state: "visible", timeout: 10000 });
    await cursorClick(page, "table tbody tr td", 1);
    await page.waitForURL("**/clients/**", { timeout: 10000 });
    await page.waitForLoadState("networkidle");
    await injectCursor(page);
    await wait(PAUSE.LONG);

    // ---- Click Send Email button on the client detail page ----
    console.log("-> Clicking Send Email button...");
    const sendEmailBtn = page
      .locator('button:has-text("Send Email"), a:has-text("Send Email")')
      .first();
    await sendEmailBtn.waitFor({ state: "visible", timeout: 5000 });
    await cursorClick(
      page,
      'button:has-text("Send Email"), a:has-text("Send Email")'
    );
    await wait(PAUSE.LONG);

    // ---- Wait for dialog ----
    console.log("-> Send Email dialog opened...");
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await wait(PAUSE.MEDIUM);

    // ---- Select filing context ----
    console.log("-> Selecting filing context...");
    const filingSelect = page.locator('[role="dialog"] [data-slot="select-trigger"]').first();
    if (await filingSelect.isVisible()) {
      await cursorClick(page, '[role="dialog"] [data-slot="select-trigger"]', 0);
      await wait(PAUSE.SHORT);

      // Select Corporation Tax
      const corpTaxOption = page.locator('[role="option"]:has-text("Corporation Tax")').first();
      if (await corpTaxOption.isVisible()) {
        await cursorClick(page, '[role="option"]:has-text("Corporation Tax")');
      } else {
        await cursorClick(page, '[role="option"]', 1);
      }
      await wait(PAUSE.LONG);
    }

    // ---- Select template ----
    console.log("-> Selecting email template...");
    const templateSelect = page.locator('[role="dialog"] [data-slot="select-trigger"]').nth(1);
    if (await templateSelect.isVisible()) {
      await cursorClick(page, '[role="dialog"] [data-slot="select-trigger"]', 1);
      await wait(PAUSE.SHORT);

      // Select "Follow-Up Reminder"
      const followUpOption = page.locator('[role="option"]:has-text("Follow-Up Reminder")').first();
      if (await followUpOption.isVisible()) {
        await cursorClick(page, '[role="option"]:has-text("Follow-Up Reminder")');
      } else {
        await cursorClick(page, '[role="option"]', 1);
      }
      await wait(PAUSE.LONG);
    }

    // ---- Show the email content with personalised variables ----
    console.log("-> Reviewing email content...");
    await wait(PAUSE.MEDIUM);

    // ---- Scroll down within the dialog to show the full email content ----
    console.log("-> Scrolling down to see the full email...");
    const dialogContent = page.locator('[role="dialog"]').first();
    await dialogContent.evaluate((el) => {
      const scrollable = el.querySelector('[data-slot="dialog-content"]') || el;
      scrollable.scrollTop = scrollable.scrollHeight;
    });
    await injectCursor(page);
    await wait(PAUSE.READ);

    // ---- Click Next to preview ----
    console.log("-> Proceeding to preview...");
    const nextBtn = page.locator('[role="dialog"] button:has-text("Next")').first();
    if (await nextBtn.isVisible()) {
      await nextBtn.scrollIntoViewIfNeeded();
      await injectCursor(page);
      await cursorClick(page, '[role="dialog"] button:has-text("Next")');
      await wait(PAUSE.LONG);
    }

    // ---- Preview screen — show personalised email content ----
    console.log("-> On Preview & Confirm screen...");
    await wait(PAUSE.READ);

    // ---- Click Send ----
    console.log("-> Sending email...");
    const sendBtn = page.locator('[role="dialog"] button:has-text("Send to")').first();
    if (await sendBtn.isVisible()) {
      await cursorClick(page, '[role="dialog"] button:has-text("Send to")');
      await wait(PAUSE.LONG);
    }

    // ---- Wait for sending to complete ----
    console.log("-> Waiting for email to be sent...");
    const resultsTitle = page.locator('[role="dialog"]:has-text("Send Complete")');
    try {
      await resultsTitle.waitFor({ state: "visible", timeout: 30000 });
    } catch {
      await wait(5000);
    }
    await wait(PAUSE.READ);

    // ---- Show the results ----
    console.log("-> Showing send results...");
    await wait(PAUSE.READ);

    // ---- Close modal ----
    console.log("-> Closing modal...");
    const doneBtn = page.locator('[role="dialog"] button:has-text("Done")').first();
    if (await doneBtn.isVisible()) {
      await cursorClick(page, '[role="dialog"] button:has-text("Done")');
    } else {
      await page.keyboard.press("Escape");
    }
    await wait(PAUSE.MEDIUM);

    console.log("-> Single client email demo complete.");
  },
};

export default demo;
