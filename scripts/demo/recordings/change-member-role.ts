/**
 * Recording: Change a Team Member's Role
 *
 * Navigate to Settings, view the team card on the General tab,
 * find a real team member (seeded via seed-demo-data.ts), and change
 * their role from member to admin using the role change dialog.
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
  id: "change-member-role",
  title: "Change a Team Member's Role",
  description:
    "View team members and change a member's role between admin and member.",
  tags: ["team", "members", "role", "admin", "member", "change", "settings"],
  category: "Settings",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/settings");

    // General tab is the default — Team card should be visible
    // Wait for the team card to load (the member list with "Change role" buttons)
    console.log("-> Waiting for team card to load...");
    await page.waitForSelector('h2:has-text("Team")', { timeout: 15000 });
    await wait(PAUSE.MEDIUM);

    // Scroll the team card into view
    const teamHeading = page.locator('h2:has-text("Team")');
    await teamHeading.scrollIntoViewIfNeeded();
    await injectCursor(page);
    await wait(PAUSE.SHORT);

    // Wait for real team members to appear (active members with "Change role" buttons)
    // The seed data creates James Wilson (member) and Sophie Chen (admin) as real users
    console.log("-> Waiting for team members to load...");
    await page.waitForSelector('button:has-text("Change role")', {
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
    // Look for an enabled "Change role" button — disabled ones belong to the current user's row.
    console.log("-> Looking for an enabled Change role button on a team member row...");
    const changeRoleBtns = page.locator('button:has-text("Change role")');
    const btnCount = await changeRoleBtns.count();
    let clickedChangeRole = false;

    for (let i = 0; i < btnCount; i++) {
      const btn = changeRoleBtns.nth(i);
      const isDisabled = await btn.isDisabled().catch(() => true);
      if (!isDisabled) {
        // Found an enabled button — get the member name from the same row
        const row = btn.locator('xpath=ancestor::div[contains(@class,"flex items-center justify-between")]');
        const memberName = await row.locator('span.font-medium').first().textContent().catch(() => "team member");
        console.log(`-> Found ${memberName} — clicking Change role...`);

        // Hover over the member name first
        const nameEl = row.locator('span.font-medium').first();
        if (await nameEl.isVisible().catch(() => false)) {
          await nameEl.scrollIntoViewIfNeeded();
          await injectCursor(page);
          await wait(PAUSE.MEDIUM);
        }

        await btn.scrollIntoViewIfNeeded();
        await btn.click();
        clickedChangeRole = true;
        break;
      }
    }

    if (!clickedChangeRole) {
      console.log("-> No enabled Change role buttons found (only one active member?) — ending demo.");
      await wait(PAUSE.READ);
      return;
    }
    await wait(PAUSE.MEDIUM);

    // Wait for the role change dialog to appear
    console.log("-> Role change dialog opened...");
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await wait(PAUSE.MEDIUM);

    // Read the dialog description to show what's happening
    const dialogDesc = page.locator('[role="dialog"] p, [role="dialog"] [data-description]');
    if (await dialogDesc.first().isVisible().catch(() => false)) {
      await cursorMove(page, '[role="dialog"] p, [role="dialog"] [data-description]');
      await wait(PAUSE.READ);
    }

    // The dialog has a Select for the new role — click to open it
    console.log("-> Opening role selector...");
    await cursorClick(page, '[role="dialog"] button[role="combobox"]');
    await wait(PAUSE.SHORT);

    // Wait for dropdown options to appear
    await page.waitForSelector('[role="option"]', { timeout: 5000 });
    await wait(PAUSE.SHORT);

    // Select "Admin" to promote the member
    const adminOption = page.locator('[role="option"]:has-text("Admin")');
    if (await adminOption.isVisible()) {
      console.log("-> Selecting Admin role...");
      await cursorClick(page, '[role="option"]:has-text("Admin")');
    } else {
      // Fallback: click the first option
      await cursorClick(page, '[role="option"]', 0);
    }
    await wait(PAUSE.MEDIUM);

    // Click the Confirm button to save the change
    console.log("-> Confirming role change...");
    await cursorClick(
      page,
      '[role="dialog"] button:has-text("Confirm")'
    );
    await wait(PAUSE.READ);

    // The dialog should close and the member list refreshes
    console.log("-> Role changed successfully — pausing for viewer...");
    await wait(PAUSE.READ);
  },
};

export default demo;
