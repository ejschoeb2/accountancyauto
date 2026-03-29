/**
 * Recording: Mark a Filing as Complete
 *
 * Navigate to Coastal Catering Services LLP which has records_received
 * for ct600_filing. Mark records as received if needed (DocumentCard
 * can clear seeded state), then clearly move cursor to the Completed
 * checkbox and click it.
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
  id: "mark-filing-complete",
  title: "Mark a Filing as Complete",
  description:
    "On the client detail page, click the 'Completed' checkbox on a filing that has records received to mark it as done for the current period.",
  tags: ["filing", "complete", "done", "mark", "status", "client"],
  category: "Clients",
  hasSideEffects: true,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/clients");

    // ---- Search for Coastal Catering ----
    console.log("-> Searching for Coastal Catering Services LLP...");
    const searchInput = page.locator('input[placeholder="Search by client name..."]');
    await searchInput.waitFor({ state: "visible", timeout: 10000 });
    await cursorType(page, 'input[placeholder="Search by client name..."]', "Coastal Catering");
    await wait(PAUSE.LONG);

    // ---- Click on the client ----
    console.log("-> Clicking on Coastal Catering...");
    const clientNameCell = page.locator('td:has(> span.text-muted-foreground)').first();
    await clientNameCell.waitFor({ state: "visible", timeout: 5000 });
    await cursorClick(page, 'td:has(> span.text-muted-foreground)', 0);
    await page.waitForURL(/\/clients\/[a-f0-9-]+/, { timeout: 15000 });
    await page.waitForLoadState("networkidle");
    await injectCursor(page);
    await wait(PAUSE.LONG);

    // ---- Scroll to Filing Management ----
    console.log("-> Scrolling to Filing Management...");
    const filingSection = page.locator('h2:has-text("Filing Management")');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await injectCursor(page);
    await wait(PAUSE.SHORT);
    await filingSection.waitFor({ state: "visible", timeout: 10000 });
    await filingSection.scrollIntoViewIfNeeded();
    await injectCursor(page);
    await wait(PAUSE.MEDIUM);

    // ---- Find a filing card that's not already completed ----
    // Try ct600_filing first (may not be completed yet), fall back to corporation_tax_payment
    console.log("-> Locating a filing card to complete...");
    let targetCardId = '#filing-ct600_filing';
    let targetCard = page.locator(targetCardId);

    if (!(await targetCard.isVisible().catch(() => false))) {
      targetCardId = '#filing-corporation_tax_payment';
      targetCard = page.locator(targetCardId);
    }

    await targetCard.waitFor({ state: "visible", timeout: 10000 });
    await targetCard.scrollIntoViewIfNeeded();
    await injectCursor(page);
    await wait(PAUSE.MEDIUM);

    // Show the card
    await cursorMove(page, targetCardId);
    await wait(PAUSE.READ);

    // ---- Ensure records are marked as received ----
    // DocumentCard syncs records_received_for on load and can clear seeded values
    console.log("-> Marking records as received...");
    const receivedBtn = targetCard.locator('button[aria-label*="documents as received"]').first();
    if (await receivedBtn.isVisible().catch(() => false)) {
      const isChecked = await receivedBtn.getAttribute('aria-checked');
      if (isChecked !== 'true') {
        await cursorMove(page, `${targetCardId} button[aria-label*="documents as received"]`);
        await wait(PAUSE.MEDIUM);
        await receivedBtn.click();
        await page.waitForLoadState("networkidle");
        await wait(PAUSE.LONG);
        await wait(PAUSE.LONG);
      }
    }

    // ---- Now clearly show and click the Completed checkbox ----
    console.log("-> Moving cursor to Completed checkbox...");
    const completedBtn = targetCard.locator('button[aria-label*="as completed"]').first();
    await completedBtn.waitFor({ state: "visible", timeout: 5000 });
    await completedBtn.scrollIntoViewIfNeeded();
    await injectCursor(page);

    // Move cursor to the checkbox area slowly and obviously
    await cursorMove(page, `${targetCardId} button[aria-label*="as completed"]`);
    await wait(PAUSE.READ);

    // ---- Click the Completed checkbox ----
    console.log("-> Clicking the Completed checkbox...");
    const isDisabled = await completedBtn.isDisabled().catch(() => true);
    if (!isDisabled) {
      await cursorClick(page, `${targetCardId} button[aria-label*="as completed"]`);
    } else {
      // Fallback: force click the label
      console.log("-> Button disabled, using label click...");
      const completedLabel = targetCard.locator('label:has-text("Completed")').first();
      await completedLabel.click({ force: true });
    }
    await wait(PAUSE.LONG);

    // ---- Show the result ----
    console.log("-> Filing marked as complete — reviewing result...");
    await targetCard.scrollIntoViewIfNeeded();
    await injectCursor(page);
    await cursorMove(page, targetCardId);
    await wait(PAUSE.READ);

    // Show Roll Over button if available
    const rollOverBtn = targetCard.locator('button:has-text("Roll Over")');
    if (await rollOverBtn.isVisible().catch(() => false)) {
      console.log("-> Roll Over button is now available...");
      await cursorMove(page, `${targetCardId} button:has-text("Roll Over")`);
      await wait(PAUSE.READ);
    }

    console.log("-> Mark filing complete demo finished.");
    await wait(PAUSE.SHORT);
  },
};

export default demo;
