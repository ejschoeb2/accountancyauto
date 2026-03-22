/**
 * Recording: Manage Team Members
 *
 * Navigate to /settings, stay on the General tab, scroll to the Team card,
 * view team members, hover over action buttons.
 */

import {
  type DemoDefinition,
  login,
  navigateTo,
  cursorClick,
  cursorMove,
  wait,
  PAUSE,
} from "../helpers";

const demo: DemoDefinition = {
  id: "manage-team-members",
  title: "Manage Team Members",
  description: "View team members, assign client access, and manage roles (admin/member) in your organisation.",
  tags: ["team", "members", "invite", "roles", "admin", "organisation", "settings"],
  category: "Settings",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/settings");

    // ─── General tab is the default ───
    console.log("→ On General tab — scrolling to Team card...");

    // Scroll the Team card into view
    const teamHeading = page.locator('h2:has-text("Team")');
    await teamHeading.scrollIntoViewIfNeeded();
    await wait(PAUSE.SHORT);

    await cursorMove(page, 'h2:has-text("Team")');
    await wait(PAUSE.MEDIUM);

    // ─── View team summary ───
    console.log("→ Viewing team summary...");
    await cursorMove(page, 'p:has-text("Manage your team members")');
    await wait(PAUSE.SHORT);
    await cursorMove(page, '.flex.flex-wrap.gap-4.text-sm');
    await wait(PAUSE.MEDIUM);

    // ─── Browse the members list ───
    console.log("→ Browsing team members list...");
    // Wait for the member list to load (it fetches via useEffect)
    await page.waitForSelector('.divide-y.divide-border', { timeout: 10000 }).catch(() => {});
    await wait(PAUSE.SHORT);

    // Hover over the first member row
    const memberRows = page.locator('.divide-y.divide-border > div');
    const rowCount = await memberRows.count();

    if (rowCount > 0) {
      await cursorMove(page, '.divide-y.divide-border > div', 0);
      await wait(PAUSE.MEDIUM);

      // Hover over Change role button if visible
      const changeRoleBtn = page.locator('button:has-text("Change role")').first();
      if (await changeRoleBtn.isVisible().catch(() => false)) {
        console.log("→ Hovering over Change role button...");
        await cursorMove(page, 'button:has-text("Change role")');
        await wait(PAUSE.SHORT);
      }

      // Hover over Remove button if visible
      const removeBtn = page.locator('button:has-text("Remove")').first();
      if (await removeBtn.isVisible().catch(() => false)) {
        console.log("→ Hovering over Remove button...");
        await cursorMove(page, 'button:has-text("Remove")');
        await wait(PAUSE.SHORT);
      }
    }

    await wait(PAUSE.READ);
    console.log("→ Done — team members viewed.");
  },
};

export default demo;
