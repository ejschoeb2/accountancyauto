/**
 * Recording: Export Client Data (DSAR)
 *
 * On the client detail page, scroll down through all sections to the
 * Compliance section at the bottom, pause to show it, then click the
 * DSAR Export button.
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
    await navigateTo(page, "/clients");

    // ---- Navigate to a client detail page ----
    console.log("-> Clicking on a client row...");
    await cursorClick(page, "table tbody tr", 0);
    await page.waitForURL("**/clients/**", { timeout: 10000 });
    await page.waitForLoadState("networkidle");
    await injectCursor(page);
    await wait(PAUSE.LONG);

    // ---- Scroll down gradually to show the page content ----
    console.log("-> Scrolling down through Client Details...");
    const clientDetails = page.locator('h2:has-text("Client Details")');
    if (await clientDetails.isVisible().catch(() => false)) {
      await clientDetails.scrollIntoViewIfNeeded();
      await injectCursor(page);
      await wait(PAUSE.MEDIUM);
    }

    // Scroll to Filing Management
    console.log("-> Scrolling past Filing Management...");
    const filingSection = page.locator('h2:has-text("Filing Management")');
    if (await filingSection.isVisible().catch(() => false)) {
      await filingSection.scrollIntoViewIfNeeded();
      await injectCursor(page);
      await wait(PAUSE.MEDIUM);
    }

    // Continue scrolling down to find Compliance section
    console.log("-> Scrolling to Compliance section...");

    // Scroll the page down more to reach the bottom
    await page.evaluate(() => window.scrollBy(0, 500));
    await injectCursor(page);
    await wait(PAUSE.SHORT);

    await page.evaluate(() => window.scrollBy(0, 500));
    await injectCursor(page);
    await wait(PAUSE.SHORT);

    await page.evaluate(() => window.scrollBy(0, 500));
    await injectCursor(page);
    await wait(PAUSE.SHORT);

    // Try to find the Compliance heading
    const complianceSection = page.locator('h2:has-text("Compliance")');
    if (await complianceSection.isVisible().catch(() => false)) {
      await complianceSection.scrollIntoViewIfNeeded();
      await injectCursor(page);
      await wait(PAUSE.MEDIUM);
    } else {
      // Scroll all the way to the bottom
      console.log("-> Scrolling to bottom of page...");
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await injectCursor(page);
      await wait(PAUSE.MEDIUM);
    }

    // ---- Show the DSAR description ----
    console.log("-> Reviewing DSAR export section...");
    if (await complianceSection.isVisible().catch(() => false)) {
      await cursorMove(page, 'h2:has-text("Compliance")');
      await wait(PAUSE.READ);
    }

    // Scroll down a bit more to make sure the DSAR button is visible
    await page.evaluate(() => window.scrollBy(0, 200));
    await injectCursor(page);
    await wait(PAUSE.SHORT);

    // ---- Click the DSAR Export button ----
    console.log("-> Clicking DSAR Export button...");
    const dsarBtn = page.locator('button:has-text("DSAR Export")');
    if (await dsarBtn.isVisible().catch(() => false)) {
      await dsarBtn.scrollIntoViewIfNeeded();
      await injectCursor(page);
      await wait(PAUSE.SHORT);

      await cursorClick(page, 'button:has-text("DSAR Export")');
      await wait(PAUSE.LONG);

      // Wait for download (button text may change to "Preparing export...")
      console.log("-> Export in progress...");
      await wait(PAUSE.READ);
    } else {
      console.log("-> DSAR Export button not found — scrolling to show it...");
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await injectCursor(page);
      await wait(PAUSE.LONG);

      // Try again
      if (await dsarBtn.isVisible().catch(() => false)) {
        await cursorClick(page, 'button:has-text("DSAR Export")');
        await wait(PAUSE.LONG);
        await wait(PAUSE.READ);
      }
    }

    console.log("-> DSAR export demo complete.");
    await wait(PAUSE.SHORT);
  },
};

export default demo;
