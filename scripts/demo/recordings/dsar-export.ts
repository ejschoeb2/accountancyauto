/**
 * Recording: Export Client Data (DSAR)
 *
 * Navigate quickly to a client detail page and scroll to the Compliance
 * section to click the DSAR Export button.
 *
 * NOTE: The login() helper takes ~11s which gets trimmed by ffmpeg.
 * This script adds an extra initial wait to ensure the trimmed video
 * starts cleanly on the dashboard, not mid-login.
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
  id: "dsar-export",
  title: "Export Client Data (DSAR)",
  description:
    "Download all data held for a client as a JSON export for GDPR data subject access requests.",
  tags: ["dsar", "export", "gdpr", "data", "download", "client", "privacy"],
  category: "Clients",
  hasSideEffects: false,

  async record({ page }) {
    await login(page);
    // Extra wait so the trimmed video starts cleanly on the dashboard
    await wait(1000);
    await navigateTo(page, "/clients");

    // ---- Navigate to a client detail page (click name cell) ----
    console.log("-> Clicking on a client name...");
    await cursorClick(page, 'td:has(> span.text-muted-foreground)', 0);
    await page.waitForURL("**/clients/**", { timeout: 10000 });
    await page.waitForLoadState("networkidle");
    await injectCursor(page);
    await wait(PAUSE.SHORT);

    // ---- Scroll directly to Compliance section ----
    console.log("-> Scrolling to Compliance section...");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await injectCursor(page);
    await wait(PAUSE.SHORT);

    const complianceSection = page.locator('h2:has-text("Compliance")');
    if (await complianceSection.isVisible().catch(() => false)) {
      await complianceSection.scrollIntoViewIfNeeded();
      await injectCursor(page);
      await cursorMove(page, 'h2:has-text("Compliance")');
      await wait(PAUSE.SHORT);
    }

    // ---- Click the DSAR Export button ----
    console.log("-> Clicking DSAR Export button...");
    const dsarBtn = page.locator('button:has-text("DSAR Export")');
    if (await dsarBtn.isVisible().catch(() => false)) {
      await dsarBtn.scrollIntoViewIfNeeded();
      await injectCursor(page);
      await cursorClick(page, 'button:has-text("DSAR Export")');
      await wait(PAUSE.LONG);

      // Wait for download
      console.log("-> Export in progress...");
      await wait(PAUSE.MEDIUM);
    } else {
      console.log("-> DSAR Export button not found.");
      await wait(PAUSE.MEDIUM);
    }

    console.log("-> DSAR export demo complete.");
    await wait(PAUSE.SHORT);
  },
};

export default demo;
