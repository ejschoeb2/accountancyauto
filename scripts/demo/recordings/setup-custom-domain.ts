/**
 * Recording: Set Up a Custom Sending Domain
 *
 * Navigate to /settings, switch to Email tab, find the domain setup card,
 * enter a domain name and click Set Up Domain. Stops before DNS verification.
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
  id: "setup-custom-domain",
  title: "Set Up a Custom Sending Domain",
  description: "Configure a custom email domain with DNS records (DKIM, SPF) so emails are sent from your practice's domain.",
  tags: ["domain", "custom", "dns", "dkim", "spf", "email", "settings", "branding"],
  category: "Settings",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/settings");

    // ─── Switch to Email tab ───
    console.log("→ Switching to Email tab...");
    await cursorClick(page, '[data-slot="tabs-trigger"]:has-text("Email")');
    await wait(PAUSE.MEDIUM);

    // ─── Locate Custom Sending Domain card ───
    console.log("→ Viewing Custom Sending Domain card...");
    await cursorMove(page, 'text="Custom Sending Domain"');
    await wait(PAUSE.SHORT);

    // ─── Enter domain ───
    console.log("→ Entering domain name...");
    await cursorType(page, '#setup-domain', "smithaccounting.co.uk", { delay: 30 });
    await wait(PAUSE.MEDIUM);

    // ─── Click Set Up Domain ───
    console.log("→ Clicking Set Up Domain...");
    await cursorClick(page, 'button:has-text("Set Up Domain")');
    await wait(PAUSE.LONG);

    // ─── If DNS records appear, browse them ───
    console.log("→ Viewing DNS records (if displayed)...");
    const dnsTable = page.locator('table').first();
    if (await dnsTable.isVisible().catch(() => false)) {
      await cursorMove(page, 'table');
      await wait(PAUSE.READ);

      // Select a domain provider
      console.log("→ Selecting a domain provider...");
      const cloudflareBtn = page.locator('button:has-text("Cloudflare")');
      if (await cloudflareBtn.isVisible().catch(() => false)) {
        await cursorClick(page, 'button:has-text("Cloudflare")');
        await wait(PAUSE.READ);
      }
    }

    await wait(PAUSE.READ);
    console.log("→ Done — domain setup shown (stops before DNS verification).");
  },
};

export default demo;
