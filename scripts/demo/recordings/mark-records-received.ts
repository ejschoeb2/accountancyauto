/**
 * Recording: Mark Records as Received
 *
 * On the client detail page, find a filing card and toggle the
 * Records Received checkbox to indicate the client has sent their paperwork.
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
  id: "mark-records-received",
  title: "Mark Records as Received",
  description:
    "Toggle the 'Records Received' status on a filing to indicate the client has sent their paperwork.",
  tags: ["records", "received", "filing", "status", "client", "paperwork"],
  category: "Clients",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/clients");

    // ---- Navigate to a client detail page ----
    console.log("-> Clicking on a client row...");
    await cursorClick(page, "table tbody tr", 0);
    await page.waitForURL("**/clients/**", { timeout: 10000 });
    await page.waitForLoadState("networkidle");
    await wait(PAUSE.LONG);

    // ---- Scroll to Filing Management ----
    console.log("-> Scrolling to Filing Management...");
    const filingSection = page.locator('h2:has-text("Filing Management")');
    await filingSection.scrollIntoViewIfNeeded();
    await wait(PAUSE.MEDIUM);

    // ---- Locate a filing card ----
    console.log("-> Locating a filing card...");
    const filingCard = page.locator('[id^="filing-"]').first();
    await filingCard.scrollIntoViewIfNeeded();
    await cursorMove(page, '[id^="filing-"]');
    await wait(PAUSE.MEDIUM);

    // ---- Click the records received checkbox ----
    // The checkbox has an aria-label like "Mark all {type} documents as received"
    console.log("-> Toggling records received...");
    const receivedCheckbox = page
      .locator('[id^="filing-"] [aria-label*="documents as received"]')
      .first();
    if (await receivedCheckbox.isVisible()) {
      await cursorClick(
        page,
        '[id^="filing-"] [aria-label*="documents as received"]'
      );
    } else {
      // Fallback: click the "received" label text
      const receivedLabel = page
        .locator('[id^="filing-"] label:has-text("received")')
        .first();
      if (await receivedLabel.isVisible()) {
        await cursorClick(page, '[id^="filing-"] label:has-text("received")');
      }
    }
    await wait(PAUSE.LONG);

    // ---- Show the result ----
    console.log("-> Records marked as received — reviewing result...");
    await cursorMove(page, '[id^="filing-"]');
    await wait(PAUSE.READ);

    console.log("-> Mark records received demo finished.");
    await wait(PAUSE.SHORT);
  },
};

export default demo;
