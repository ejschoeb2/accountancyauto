/**
 * Recording: Remove a Team Member
 *
 * Navigate to Settings, view the team card on the General tab,
 * find a real team member (seeded via seed-demo-data.ts), click Remove,
 * show the confirmation dialog describing what happens, then cancel
 * without actually removing them (to keep seed data intact).
 *
 * Requires: seed-demo-data.ts to have created James Wilson (member)
 * and Sophie Chen (admin) as real auth users linked to the org.
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
  id: "remove-team-member",
  title: "Remove a Team Member",
  description:
    "Remove a team member from your organisation — shows the confirmation and what happens to their data.",
  tags: ["team", "members", "remove", "delete", "settings"],
  category: "Settings",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/settings");

    // General tab is the default — Team card should be visible
    console.log("-> Waiting for team card to load...");
    await page.waitForSelector('h2:has-text("Team")', { timeout: 15000 });
    await wait(PAUSE.MEDIUM);

    // Scroll the team card into view
    const teamHeading = page.locator('h2:has-text("Team")');
    await teamHeading.scrollIntoViewIfNeeded();
    await injectCursor(page);
    await wait(PAUSE.SHORT);

    // Wait for real team members to appear (active members with "Remove" buttons)
    console.log("-> Waiting for team members to load...");
    await page.waitForSelector('button:has-text("Remove")', {
      timeout: 15000,
    });
    await wait(PAUSE.MEDIUM);

    // Hover over the Members heading to draw attention to the list
    console.log("-> Viewing team members...");
    const membersLabel = page.locator(
      'p:has-text("Members"), .uppercase:has-text("Members")'
    );
    if (await membersLabel.first().isVisible().catch(() => false)) {
      await cursorMove(
        page,
        'p:has-text("Members"), .uppercase:has-text("Members")'
      );
      await wait(PAUSE.MEDIUM);
    }

    // Find a team member who is NOT the current user (buttons are disabled for your own row).
    // Look for an enabled "Remove" button.
    console.log("-> Looking for an enabled Remove button on a team member row...");
    const removeBtns = page.locator('button:has-text("Remove")');
    const removeBtnCount = await removeBtns.count();
    let clickedRemove = false;

    for (let i = 0; i < removeBtnCount; i++) {
      const btn = removeBtns.nth(i);
      const isDisabled = await btn.isDisabled().catch(() => true);
      if (!isDisabled) {
        // Found an enabled button — get the member name from the same row
        const row = btn.locator('xpath=ancestor::div[contains(@class,"flex items-center justify-between")]');
        const memberName = await row.locator('span.font-medium').first().textContent().catch(() => "team member");
        console.log(`-> Found ${memberName} — hovering over their row...`);

        const nameEl = row.locator('span.font-medium').first();
        if (await nameEl.isVisible().catch(() => false)) {
          await nameEl.scrollIntoViewIfNeeded();
          await injectCursor(page);
          await wait(PAUSE.MEDIUM);
        }

        console.log(`-> Clicking Remove on ${memberName}...`);
        await btn.scrollIntoViewIfNeeded();
        await btn.click();
        clickedRemove = true;
        break;
      }
    }

    if (!clickedRemove) {
      console.log("-> No enabled Remove buttons found (only one active member?) — ending demo.");
      await wait(PAUSE.READ);
      return;
    }
    await wait(PAUSE.MEDIUM);

    // Wait for the remove confirmation dialog to appear
    console.log("-> Remove confirmation dialog opened...");
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await wait(PAUSE.MEDIUM);

    // Read the dialog content — hover over the description to let user read it
    // The dialog says "Remove <email> from the team? This will immediately revoke their access."
    const dialogDesc = page.locator(
      '[role="dialog"] p, [role="dialog"] [data-description]'
    );
    if (await dialogDesc.first().isVisible().catch(() => false)) {
      await cursorMove(
        page,
        '[role="dialog"] p, [role="dialog"] [data-description]'
      );
      await wait(PAUSE.READ);
    }

    // Show the destructive Remove button in the dialog — hover to highlight it
    console.log("-> Showing the Remove button (will cancel instead)...");
    const dialogRemoveBtn = page.locator(
      '[role="dialog"] button:has-text("Remove")'
    );
    if (await dialogRemoveBtn.isVisible().catch(() => false)) {
      await cursorMove(page, '[role="dialog"] button:has-text("Remove")');
      await wait(PAUSE.LONG);
    }

    // Click Close to dismiss the dialog without removing
    console.log("-> Cancelling — closing the dialog...");
    const closeBtn = page.locator(
      '[role="dialog"] button:has-text("Close"), [role="dialog"] button:has-text("Cancel")'
    );
    if (await closeBtn.first().isVisible()) {
      await cursorClick(
        page,
        '[role="dialog"] button:has-text("Close"), [role="dialog"] button:has-text("Cancel")'
      );
    } else {
      // Fallback: press Escape to close the dialog
      await page.keyboard.press("Escape");
    }
    await wait(PAUSE.MEDIUM);

    console.log(
      "-> Dialog dismissed — member NOT removed. Pausing for viewer..."
    );
    await wait(PAUSE.READ);
  },
};

export default demo;
