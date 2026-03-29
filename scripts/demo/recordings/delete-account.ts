/**
 * Recording: Delete Your Account
 *
 * Navigate to /settings, scroll to the Delete Account card, click the
 * delete button to open the confirmation dialog, then dismiss it
 * (stops before confirming).
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
  id: "delete-account",
  title: "Delete Your Account",
  description: "Walk through the account deletion flow -- shows the confirmation dialog and what data will be removed.",
  tags: ["delete", "account", "remove", "settings", "danger"],
  category: "Settings",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/settings");

    // ─── Scroll quickly to Delete Account card ───
    console.log("→ Scrolling to Delete Account card...");
    const deleteHeading = page.locator('h2:has-text("Delete Account")');
    await deleteHeading.scrollIntoViewIfNeeded();
    await injectCursor(page);
    await wait(300);

    await cursorMove(page, 'h2:has-text("Delete Account")');
    await wait(PAUSE.SHORT);

    // ─── Read the card description ───
    console.log("→ Reading delete account description...");
    await cursorMove(page, 'p:has-text("Permanently delete your account")');
    await wait(PAUSE.MEDIUM);

    // ─── Click the Delete account button to open the AlertDialog ───
    console.log("→ Opening delete confirmation dialog...");
    await cursorClick(page, 'button:has-text("Delete account")');
    await wait(PAUSE.MEDIUM);

    // ─── Read the dialog content ───
    console.log("→ Reading confirmation dialog...");
    await page.waitForSelector('[role="alertdialog"]', { timeout: 5000 });
    await wait(PAUSE.SHORT);

    await cursorMove(page, 'text="Are you sure you want to delete your account?"');
    await wait(PAUSE.READ);

    await cursorMove(page, '[data-slot="alert-dialog-description"]');
    await wait(PAUSE.READ);

    // ─── Hover over "Keep my account" (safe option) ───
    console.log("→ Hovering over Keep my account...");
    await cursorMove(page, 'button:has-text("Keep my account")');
    await wait(PAUSE.MEDIUM);

    // ─── Click "Keep my account" to dismiss ───
    console.log("→ Clicking Keep my account...");
    await cursorClick(page, 'button:has-text("Keep my account")');
    await wait(PAUSE.READ);

    console.log("→ Done — delete dialog shown and dismissed (no data deleted).");
  },
};

export default demo;
