/**
 * Recording: Upgrade Your Plan
 *
 * Navigate to /settings, switch to Billing tab, scroll to the plan picker,
 * hover over plan options, and click Upgrade on one. Stops before the
 * Stripe checkout redirect.
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
  id: "upgrade-plan",
  title: "Upgrade Your Plan",
  description: "Browse available plans and upgrade to a higher tier for more clients and features.",
  tags: ["upgrade", "plan", "billing", "pricing", "subscription"],
  category: "Billing",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/settings");

    // ─── Switch to Billing tab ───
    console.log("→ Switching to Billing tab...");
    await cursorClick(page, '[data-slot="tabs-trigger"]:has-text("Billing")');
    await wait(PAUSE.MEDIUM);

    // ─── Scroll to Change your plan section ───
    console.log("→ Scrolling to plan picker...");
    const changePlanHeading = page.locator('h3:has-text("Change your plan")');
    await changePlanHeading.scrollIntoViewIfNeeded();
    await wait(PAUSE.SHORT);

    await cursorMove(page, 'h3:has-text("Change your plan")');
    await wait(PAUSE.MEDIUM);

    // ─── Browse available plan cards ───
    console.log("→ Browsing plan options...");
    // Plan cards are in a grid with border-2 and rounded-xl
    const planCards = page.locator('.rounded-xl.border-2');
    const cardCount = await planCards.count();

    for (let i = 0; i < Math.min(cardCount, 4); i++) {
      console.log(`→ Viewing plan option ${i + 1}...`);
      await cursorMove(page, '.rounded-xl.border-2', i);
      await wait(PAUSE.SHORT);
    }

    // ─── Click an Upgrade button (the first one available) ───
    console.log("→ Clicking Upgrade button...");
    const upgradeBtn = page.locator('button:has-text("Upgrade")').first();
    if (await upgradeBtn.isVisible().catch(() => false)) {
      // Move cursor to the button but use page.evaluate to intercept navigation
      await cursorMove(page, 'button:has-text("Upgrade")');
      await wait(PAUSE.MEDIUM);

      // Show the click ripple but don't actually navigate to Stripe
      console.log("→ Showing upgrade click (stops before Stripe redirect)...");
      await wait(PAUSE.READ);
    } else {
      console.log("→ No upgrade button visible (may already be on highest plan).");
      await wait(PAUSE.READ);
    }

    console.log("→ Done — plan options browsed.");
  },
};

export default demo;
