/**
 * Recording: Export Client Data (DSAR)
 *
 * On the client detail page, scroll to the Compliance section and
 * click the DSAR Export button to download client data.
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
  id: "dsar-export",
  title: "Export Client Data (DSAR)",
  description:
    "Download all data held for a client as a JSON export for GDPR data subject access requests.",
  tags: ["dsar", "export", "gdpr", "data", "download", "client", "privacy"],
  category: "Clients",
  hasSideEffects: false,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/clients");

    // ---- Navigate to a client detail page ----
    console.log("-> Clicking on a client row...");
    await cursorClick(page, "table tbody tr", 0);
    await page.waitForURL("**/clients/**", { timeout: 10000 });
    await page.waitForLoadState("networkidle");
    await wait(PAUSE.LONG);

    // ---- Scroll to Compliance section ----
    console.log("-> Scrolling to Compliance section...");
    const complianceSection = page.locator('h2:has-text("Compliance")');
    await complianceSection.scrollIntoViewIfNeeded();
    await wait(PAUSE.MEDIUM);

    // ---- Show the DSAR description ----
    console.log("-> Reviewing DSAR export section...");
    await cursorMove(page, 'h2:has-text("Compliance")');
    await wait(PAUSE.READ);

    // ---- Click the DSAR Export button ----
    console.log("-> Clicking DSAR Export button...");
    const dsarBtn = page.locator('button:has-text("DSAR Export")');
    if (await dsarBtn.isVisible()) {
      await cursorClick(page, 'button:has-text("DSAR Export")');
      await wait(PAUSE.LONG);

      // Wait for download (button text changes to "Preparing export...")
      console.log("-> Export in progress...");
      await wait(PAUSE.READ);
    } else {
      console.log("-> DSAR Export button not found.");
    }

    console.log("-> DSAR export demo complete.");
    await wait(PAUSE.SHORT);
  },
};

export default demo;
