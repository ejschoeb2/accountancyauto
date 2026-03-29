/**
 * Recording: View Your Current Plan & Usage
 *
 * Navigate to /settings, switch to the Billing tab, view the plan name,
 * status badge, price, and client usage bar.
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
  id: "view-billing-plan",
  title: "View Your Current Plan & Usage",
  description: "Check your current subscription tier, client usage, and billing status.",
  tags: ["billing", "plan", "subscription", "usage", "tier", "pricing"],
  category: "Billing",
  hasSideEffects: false,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/settings");

    // ─── Switch to Billing tab ───
    console.log("→ Switching to Billing tab...");
    await cursorClick(page, '[data-slot="tabs-trigger"]:has-text("Billing")');
    await wait(PAUSE.MEDIUM);

    // ─── View subscription header ───
    console.log("→ Viewing subscription overview...");
    await cursorMove(page, 'h2:has-text("Your Subscription")');
    await wait(PAUSE.SHORT);

    // ─── View plan and status ───
    console.log("→ Viewing plan details...");
    await cursorMove(page, 'text="Plan"');
    await wait(PAUSE.SHORT);
    await cursorMove(page, 'text="Status"');
    await wait(PAUSE.SHORT);

    // ─── View client usage bar ───
    console.log("→ Viewing client usage...");
    await cursorMove(page, 'text="Client Usage"');
    await wait(PAUSE.SHORT);

    const usageBar = page.locator('.h-2\\.5.w-full.rounded-full');
    if (await usageBar.isVisible().catch(() => false)) {
      await cursorMove(page, '.h-2\\.5.w-full.rounded-full');
      await wait(PAUSE.MEDIUM);
    }

    // ─── View Manage billing button ───
    const manageBillingBtn = page.locator('button:has-text("Manage billing")');
    if (await manageBillingBtn.isVisible().catch(() => false)) {
      await cursorMove(page, 'button:has-text("Manage billing")');
      await wait(PAUSE.SHORT);
    }

    await wait(PAUSE.MEDIUM);
    console.log("→ Done — billing plan and usage viewed.");
  },
};

export default demo;
