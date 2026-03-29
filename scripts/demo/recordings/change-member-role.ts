/**
 * Recording: Change a Team Member's Role
 *
 * Navigate to Settings, view the team card on the General tab,
 * find a real team member (seeded via seed-demo-data.ts), and change
 * their role from member to admin using the role change dialog.
 *
 * Requires: seed-demo-data.ts to have created James Wilson (member)
 * and Sophie Chen (admin) as real auth users linked to the org.
 * Run `npm run seed:demo` before recording.
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
    console.log("-> Waiting for team card to load...");
    await page.waitForSelector('h2:has-text("Team")', { timeout: 15000 });
    await wait(PAUSE.MEDIUM);

    // Scroll the team card into view
    const teamHeading = page.locator('h2:has-text("Team")');
    await teamHeading.scrollIntoViewIfNeeded();
    await injectCursor(page);
    await wait(PAUSE.SHORT);

    // Wait for team members to fully load — look for active member names
    // Seeded members: James Wilson (member), Sophie Chen (admin)
    console.log("-> Waiting for active team members to load...");

    // Give the team list time to fetch and render active members
    await page.waitForLoadState("networkidle");
    await wait(PAUSE.LONG);

    // Check if "Change role" buttons exist (only shown for active members)
    const changeRoleBtns = page.locator('button:has-text("Change role")');
    let btnCount = await changeRoleBtns.count();

    if (btnCount === 0) {
      // Try waiting longer — the team member query can be slow
      console.log("-> No Change role buttons yet — waiting longer...");
      try {
        await page.waitForSelector('button:has-text("Change role")', { timeout: 15000 });
        btnCount = await changeRoleBtns.count();
      } catch {
        console.log("-> No active team members found. Run `npm run seed:demo` first.");
        console.log("-> Showing team card as-is...");
        await cursorMove(page, 'h2:has-text("Team")');
        await wait(PAUSE.READ);
        return;
      }
    }

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

    // Find an enabled "Change role" button (disabled ones belong to the current user's row)
    console.log("-> Looking for an enabled Change role button...");
    let clickedChangeRole = false;

    for (let i = 0; i < btnCount; i++) {
      const btn = changeRoleBtns.nth(i);
      const isDisabled = await btn.isDisabled().catch(() => true);
      if (!isDisabled) {
        // Get the member name from the same row
        const row = btn.locator('xpath=ancestor::div[contains(@class,"flex items-center justify-between")]');
        const memberName = await row.locator('span.font-medium').first().textContent().catch(() => "team member");
        console.log(`-> Found ${memberName} — clicking Change role...`);

        // Hover over the member name first
        const nameEl = row.locator('span.font-medium').first();
        if (await nameEl.isVisible().catch(() => false)) {
          await nameEl.scrollIntoViewIfNeeded();
          await injectCursor(page);
          await cursorMove(page, 'button:has-text("Change role")', i);
          await wait(PAUSE.MEDIUM);
        }

        await cursorClick(page, 'button:has-text("Change role")', i);
        clickedChangeRole = true;
        break;
      }
    }

    if (!clickedChangeRole) {
      console.log("-> No enabled Change role buttons found — ending demo.");
      await wait(PAUSE.READ);
      return;
    }
    await wait(PAUSE.MEDIUM);

    // Wait for the role change dialog to appear
    console.log("-> Role change dialog opened...");
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await wait(PAUSE.MEDIUM);

    // Read the dialog description
    const dialogDesc = page.locator('[role="dialog"] p, [role="dialog"] [data-description]');
    if (await dialogDesc.first().isVisible().catch(() => false)) {
      await cursorMove(page, '[role="dialog"] p, [role="dialog"] [data-description]');
      await wait(PAUSE.READ);
    }

    // Open the role selector
    console.log("-> Opening role selector...");
    await cursorClick(page, '[role="dialog"] button[role="combobox"]');
    await wait(PAUSE.SHORT);

    // Wait for dropdown options
    await page.waitForSelector('[role="option"]', { timeout: 5000 });
    await wait(PAUSE.SHORT);

    // Select "Admin" to promote the member
    const adminOption = page.locator('[role="option"]:has-text("Admin")');
    if (await adminOption.isVisible()) {
      console.log("-> Selecting Admin role...");
      await cursorClick(page, '[role="option"]:has-text("Admin")');
    } else {
      await cursorClick(page, '[role="option"]', 0);
    }
    await wait(PAUSE.MEDIUM);

    // Click Confirm to save the change
    console.log("-> Confirming role change...");
    await cursorClick(
      page,
      '[role="dialog"] button:has-text("Confirm")'
    );
    await wait(PAUSE.READ);

    // The dialog should close and the member list refreshes
    console.log("-> Role changed successfully.");
    await wait(PAUSE.READ);
  },
};

export default demo;
