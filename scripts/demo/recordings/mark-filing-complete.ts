/**
 * Recording: Mark a Filing as Complete
 *
 * Navigate to "Coastal Catering Services LLP" which has records_received
 * for corporation_tax_payment and ct600_filing. The Completed checkbox is
 * only enabled when records_received is true, so this client is the right
 * choice. Scroll to filing management, find a filing card with records
 * received, and click the Completed checkbox.
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
  BASE_URL,
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

    // ---- Search for "Coastal Catering" which has records received ----
    console.log("-> Searching for Coastal Catering Services LLP...");
    const searchInput = page.locator('input[placeholder="Search by client name..."]');
    await searchInput.waitFor({ state: "visible", timeout: 5000 });
    await searchInput.fill("Coastal Catering");
    await wait(PAUSE.LONG);

    // ---- Click on the client row to navigate to detail page ----
    console.log("-> Clicking on Coastal Catering...");
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

    // ---- Find a filing card — look for one that has records received (violet status text) ----
    console.log("-> Locating a filing card with records received...");
    // Coastal Catering has records received for corporation_tax_payment and ct600_filing
    // The filing card shows "Documents received — awaiting filing"
    const receivedCards = page.locator('[id^="filing-"]');
    const cardCount = await receivedCards.count();

    let targetCardIndex = 0;
    for (let i = 0; i < cardCount; i++) {
      const cardText = await receivedCards.nth(i).textContent().catch(() => '');
      if (cardText && cardText.includes('Documents received')) {
        targetCardIndex = i;
        break;
      }
    }

    const targetCard = receivedCards.nth(targetCardIndex);
    await targetCard.scrollIntoViewIfNeeded();
    await injectCursor(page);
    await cursorMove(page, `[id^="filing-"] >> nth=${targetCardIndex}`);
    await wait(PAUSE.READ);

    // ---- Show the current state — records received but not completed ----
    console.log("-> Filing has records received — Completed checkbox is enabled...");
    await wait(PAUSE.MEDIUM);

    // ---- Click the Completed checkbox ----
    // The Completed checkbox label is inside the filing card
    console.log("-> Clicking the Completed checkbox...");
    const completedLabel = targetCard.locator('label:has-text("Completed")').first();
    if (await completedLabel.isVisible().catch(() => false)) {
      await completedLabel.scrollIntoViewIfNeeded();
      await injectCursor(page);
      // Click the label to toggle
      await completedLabel.click();
      await wait(PAUSE.LONG);
    } else {
      // Fallback: click the CheckButton with Completed aria-label
      const completedCheckbox = targetCard.locator('[aria-label*="completed"]').first();
      if (await completedCheckbox.isVisible().catch(() => false)) {
        await completedCheckbox.click();
        await wait(PAUSE.LONG);
      }
    }

    // ---- Show the result — filing now shows green "Completed" status ----
    console.log("-> Filing marked as complete — reviewing result...");
    await targetCard.scrollIntoViewIfNeeded();
    await injectCursor(page);
    await cursorMove(page, `[id^="filing-"] >> nth=${targetCardIndex}`);
    await wait(PAUSE.READ);

    // Show that the Roll Over button is now available
    const rollOverBtn = targetCard.locator('button:has-text("Roll Over")');
    if (await rollOverBtn.isVisible().catch(() => false)) {
      console.log("-> Roll Over button is now available...");
      await cursorMove(page, `[id^="filing-"] >> nth=${targetCardIndex} >> button:has-text("Roll Over")`);
      await wait(PAUSE.READ);
    }

    console.log("-> Mark filing complete demo finished.");
    await wait(PAUSE.SHORT);
  },
};

export default demo;
