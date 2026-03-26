/**
 * Recording: Mark Records as Received
 *
 * Navigate to a client (Brighton Digital LLP — approaching, not yet received),
 * scroll to filing management, show individual document checkboxes being ticked,
 * then show the overall records received toggle and how it stops reminders.
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
  id: "mark-records-received",
  title: "Mark Records as Received",
  description:
    "Tick individual document checkboxes on a filing card, toggle the overall 'Records Received' status, and see how it stops reminders for that filing.",
  tags: ["records", "received", "filing", "status", "client", "paperwork", "documents"],
  category: "Clients",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/clients");

    // ---- Search for Brighton Digital (approaching, not yet received) ----
    console.log("-> Searching for Brighton Digital LLP...");
    const searchInput = page.locator('input[placeholder="Search by client name..."]');
    await searchInput.waitFor({ state: "visible", timeout: 5000 });
    await searchInput.fill("Brighton Digital");
    await wait(PAUSE.LONG);

    // ---- Click on the client row ----
    console.log("-> Clicking on Brighton Digital...");
    const clientRow = page.locator('table tbody tr').first();
    await clientRow.waitFor({ state: "visible", timeout: 5000 });
    await cursorClick(page, "table tbody tr", 0);
    await page.waitForURL(/\/clients\/[a-f0-9-]+/, { timeout: 15000 });
    await page.waitForLoadState("networkidle");
    await injectCursor(page);
    await wait(PAUSE.LONG);

    // ---- Scroll to Filing Management ----
    console.log("-> Scrolling to Filing Management...");
    const filingSection = page.locator('h2:has-text("Filing Management")');
    await filingSection.waitFor({ state: "visible", timeout: 10000 });
    await filingSection.scrollIntoViewIfNeeded();
    await injectCursor(page);
    await wait(PAUSE.MEDIUM);

    // ---- Find the first active filing card ----
    console.log("-> Locating an active filing card...");
    const filingCards = page.locator('[id^="filing-"]');
    const cardCount = await filingCards.count();

    if (cardCount === 0) {
      console.log("-> No filing cards found.");
      return;
    }

    const firstCard = filingCards.first();
    await firstCard.scrollIntoViewIfNeeded();
    await injectCursor(page);
    await wait(PAUSE.MEDIUM);

    // ---- Show the filing card with its document checklist ----
    console.log("-> Showing the filing card and document checklist...");
    await cursorMove(page, '[id^="filing-"]');
    await wait(PAUSE.READ);

    // ---- Tick individual document checkboxes ----
    // The DocumentCard renders CheckButton items for each document type
    // Look for individual document checkboxes inside the filing card
    console.log("-> Looking for individual document checkboxes...");
    const docCheckboxes = firstCard.locator('[aria-label*="received"]');
    const docCheckCount = await docCheckboxes.count();

    // Also look for the overall "X of Y required received" label area
    const overallCheckbox = firstCard.locator('[aria-label*="Mark all"]').first();

    if (docCheckCount > 1) {
      // There are individual checkboxes — tick them one by one
      console.log(`-> Found ${docCheckCount} document checkboxes — ticking individually...`);

      // Tick first checkbox
      const firstCheckbox = docCheckboxes.first();
      await firstCheckbox.scrollIntoViewIfNeeded();
      await injectCursor(page);
      await wait(PAUSE.SHORT);
      await firstCheckbox.click();
      await wait(PAUSE.LONG);

      // Show the effect
      console.log("-> First document checked — showing updated status...");
      await wait(PAUSE.MEDIUM);

      // Tick second checkbox if available
      if (docCheckCount > 1) {
        const secondCheckbox = docCheckboxes.nth(1);
        if (await secondCheckbox.isVisible().catch(() => false)) {
          await secondCheckbox.scrollIntoViewIfNeeded();
          await injectCursor(page);
          await secondCheckbox.click();
          await wait(PAUSE.LONG);
          console.log("-> Second document checked...");
          await wait(PAUSE.MEDIUM);
        }
      }
    }

    // ---- Toggle the overall records received checkbox ----
    // This is the CheckButton at the card level with "X of Y required received" label
    if (await overallCheckbox.isVisible().catch(() => false)) {
      console.log("-> Toggling overall 'Records Received'...");
      await overallCheckbox.scrollIntoViewIfNeeded();
      await injectCursor(page);
      await cursorMove(page, '[id^="filing-"]');
      await wait(PAUSE.MEDIUM);

      await overallCheckbox.click();
      await wait(PAUSE.LONG);

      // ---- Show the result — reminders stopped ----
      console.log("-> Records received — reminders will be cancelled...");
      await firstCard.scrollIntoViewIfNeeded();
      await injectCursor(page);
      await wait(PAUSE.READ);

      // The card should now show "Documents received — awaiting filing" in violet
      const statusText = firstCard.locator('text=Documents received');
      if (await statusText.isVisible().catch(() => false)) {
        await cursorMove(page, 'text=Documents received');
        await wait(PAUSE.READ);
      }
    } else {
      // No individual document checkboxes — try the label click
      const receivedLabel = firstCard.locator('label:has-text("received")').first();
      if (await receivedLabel.isVisible().catch(() => false)) {
        console.log("-> Clicking records received label...");
        await receivedLabel.click();
        await wait(PAUSE.LONG);
      }
    }

    // ---- Show that the toast confirms reminders are cancelled ----
    console.log("-> Giving time to show the result...");
    await wait(PAUSE.READ);

    console.log("-> Mark records received demo finished.");
    await wait(PAUSE.SHORT);
  },
};

export default demo;
