/**
 * Recording: Configure Email Sender Settings
 *
 * Navigate to /settings, switch to Email tab, edit the sender name,
 * sender email local part, and reply-to address, then save.
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
  id: "configure-email-settings",
  title: "Configure Email Sender Settings",
  description: "Set your 'from' name, reply-to address, and email signature used in all outgoing emails.",
  tags: ["email", "settings", "from", "reply-to", "signature", "sender"],
  category: "Settings",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/settings");

    // ─── Switch to Email tab ───
    console.log("→ Switching to Email tab...");
    await cursorClick(page, '[data-slot="tabs-trigger"]:has-text("Email")');
    await wait(PAUSE.MEDIUM);

    // ─── Locate Email Settings card ───
    console.log("→ Viewing Email Settings card...");
    await cursorMove(page, 'text="Email Settings"');
    await wait(PAUSE.SHORT);

    // ─── Edit sender name ───
    console.log("→ Editing sender name...");
    const senderNameInput = page.locator('#settings-sender-name');
    await senderNameInput.click({ clickCount: 3 }); // select all
    await cursorType(page, '#settings-sender-name', "Smith & Co Accounting", { delay: 25 });
    await wait(PAUSE.SHORT);

    // ─── Edit sender email local part ───
    console.log("→ Editing sender email...");
    const senderLocalInput = page.locator('#settings-sender-local');
    await senderLocalInput.click({ clickCount: 3 });
    await cursorType(page, '#settings-sender-local', "reminders", { delay: 25 });
    await wait(PAUSE.SHORT);

    // ─── Edit reply-to address ───
    console.log("→ Editing reply-to address...");
    const replyToInput = page.locator('#settings-reply-to');
    await replyToInput.click({ clickCount: 3 });
    await cursorType(page, '#settings-reply-to', "info@smithaccounting.co.uk", { delay: 25 });
    await wait(PAUSE.MEDIUM);

    // ─── Save changes ───
    console.log("→ Saving changes...");
    await cursorClick(page, 'button:has-text("Save Changes")');
    await wait(PAUSE.READ);

    console.log("→ Done — email settings configured.");
  },
};

export default demo;
