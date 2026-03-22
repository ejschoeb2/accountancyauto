/**
 * Recording: View a Client's Detail Page
 *
 * Click a client row in the table, tour the detail page sections:
 * header actions, client details, filing management, and compliance.
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
  id: "client-detail-page",
  title: "View a Client's Detail Page",
  description:
    "Open a client's detail page to see their full profile, filing assignments, document uploads, and email history.",
  tags: ["client", "detail", "profile", "view", "filings", "overview"],
  category: "Clients",
  hasSideEffects: false,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/clients");

    // ---- Click on the first client row ----
    console.log("-> Clicking on a client row...");
    await cursorClick(page, "table tbody tr", 0);
    await page.waitForURL("**/clients/**", { timeout: 10000 });
    await page.waitForLoadState("networkidle");
    await wait(PAUSE.LONG);

    // ---- Tour the page header ----
    console.log("-> Viewing page header and action buttons...");
    await cursorMove(page, "h1");
    await wait(PAUSE.MEDIUM);

    // Show the action buttons in the header
    await cursorMove(page, 'button:has-text("Pause Reminders"), button:has-text("Resume Reminders")');
    await wait(PAUSE.SHORT);
    await cursorMove(page, 'button:has-text("Delete")');
    await wait(PAUSE.SHORT);
    await cursorMove(page, 'button:has-text("Send Email")');
    await wait(PAUSE.MEDIUM);

    // ---- Tour Client Details section ----
    console.log("-> Viewing Client Details section...");
    await cursorMove(page, 'h2:has-text("Client Details")');
    await wait(PAUSE.READ);

    // ---- Tour Filing Management section ----
    console.log("-> Scrolling to Filing Management...");
    const filingSection = page.locator('h2:has-text("Filing Management")');
    if (await filingSection.isVisible()) {
      await filingSection.scrollIntoViewIfNeeded();
      await cursorMove(page, 'h2:has-text("Filing Management")');
      await wait(PAUSE.READ);

      // Show a filing card
      const filingCard = page.locator('[id^="filing-"]').first();
      if (await filingCard.isVisible()) {
        await cursorMove(page, '[id^="filing-"]');
        await wait(PAUSE.MEDIUM);
      }
    }

    // ---- Tour Compliance section ----
    console.log("-> Scrolling to Compliance section...");
    const complianceSection = page.locator('h2:has-text("Compliance")');
    if (await complianceSection.isVisible()) {
      await complianceSection.scrollIntoViewIfNeeded();
      await cursorMove(page, 'h2:has-text("Compliance")');
      await wait(PAUSE.READ);
    }

    console.log("-> Client detail page tour complete.");
    await wait(PAUSE.SHORT);
  },
};

export default demo;
