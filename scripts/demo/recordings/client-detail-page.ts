/**
 * Recording: View a Client's Detail Page
 *
 * Search for Brighton Digital (has queued emails, overrides, and rich data),
 * click their name to open the detail page, tour all sections, and toggle
 * between emails and documents on a filing card.
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
  injectCursor,
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

    // ---- Search for Brighton Digital (has queued emails and overrides) ----
    console.log("-> Searching for Brighton Digital...");
    const searchInput = page.locator('input[placeholder="Search by client name..."]');
    await searchInput.waitFor({ state: "visible", timeout: 15000 });
    await cursorType(page, 'input[placeholder="Search by client name..."]', "Brighton", { delay: 30 });
    await wait(PAUSE.LONG);

    // ---- Click on the client name cell ----
    console.log("-> Clicking on Brighton Digital...");
    const clientNameCell = page.locator('td:has(> span.text-muted-foreground)').first();
    await clientNameCell.waitFor({ state: "visible", timeout: 5000 });
    await cursorClick(page, 'td:has(> span.text-muted-foreground)', 0);
    await page.waitForURL("**/clients/**", { timeout: 10000 });
    await page.waitForLoadState("networkidle");
    await injectCursor(page);
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

    // ---- Scroll down to Filing Management section ----
    console.log("-> Scrolling to Filing Management...");
    const filingSection = page.locator('h2:has-text("Filing Management")');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await injectCursor(page);
    await wait(PAUSE.SHORT);

    if (await filingSection.isVisible()) {
      await filingSection.scrollIntoViewIfNeeded();
      await injectCursor(page);
      await cursorMove(page, 'h2:has-text("Filing Management")');
      await wait(PAUSE.MEDIUM);

      // Show a filing card
      const filingCard = page.locator('[id^="filing-"]').first();
      if (await filingCard.isVisible()) {
        await cursorMove(page, '[id^="filing-"]');
        await wait(PAUSE.MEDIUM);
      }
    }

    // ---- Scroll all the way down to the bottom ----
    console.log("-> Scrolling to bottom of page...");
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
    await wait(PAUSE.LONG);

    // ---- Scroll back up to the top ----
    console.log("-> Scrolling back to top...");
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await wait(PAUSE.LONG);

    // ---- Toggle between Documents and Emails on a filing card ----
    console.log("-> Toggling between Documents and Emails view...");

    // Scroll back to filing management
    if (await filingSection.isVisible()) {
      await filingSection.scrollIntoViewIfNeeded();
      await injectCursor(page);
      await wait(PAUSE.SHORT);
    }

    // Find the Documents/Emails toggle on the Companies House card (has queued emails)
    const companiesHouseCard = page.locator('#filing-companies_house');
    const emailsToggle = companiesHouseCard.locator('button:has-text("Emails")').first();

    if (await emailsToggle.isVisible().catch(() => false)) {
      await emailsToggle.scrollIntoViewIfNeeded();
      await injectCursor(page);
      await cursorClick(page, '#filing-companies_house button:has-text("Emails")');
      await wait(PAUSE.READ);

      console.log("-> Viewing email history for this deadline...");
      await wait(PAUSE.MEDIUM);

      // Switch back to Documents
      console.log("-> Switching back to Documents...");
      const docsToggle = companiesHouseCard.locator('button:has-text("Documents")').first();
      if (await docsToggle.isVisible().catch(() => false)) {
        await cursorClick(page, '#filing-companies_house button:has-text("Documents")');
        await wait(PAUSE.READ);
      }
    } else {
      // Fallback: try first filing card
      const anyEmailsToggle = page.locator('[id^="filing-"] button:has-text("Emails")').first();
      if (await anyEmailsToggle.isVisible().catch(() => false)) {
        await anyEmailsToggle.scrollIntoViewIfNeeded();
        await injectCursor(page);
        await cursorClick(page, '[id^="filing-"] button:has-text("Emails")');
        await wait(PAUSE.READ);

        console.log("-> Viewing email history...");
        await wait(PAUSE.MEDIUM);

        await cursorClick(page, '[id^="filing-"] button:has-text("Documents")');
        await wait(PAUSE.READ);
      }
    }

    console.log("-> Client detail page tour complete.");
    await wait(PAUSE.SHORT);
  },
};

export default demo;
