/**
 * Shortlist recording: Check Client Deadlines
 *
 * Navigate to /clients, switch to "Client Deadlines" view, scroll through
 * the table fluidly, change business type to LLP, then navigate back to dashboard.
 */

import {
  type DemoDefinition,
  login,
  navigateTo,
  cursorClick,
  cursorMove,
  injectCursor,
  wait,
  PAUSE,
} from "../helpers";

const demo: DemoDefinition = {
  id: "shortlist-check-client-deadlines",
  title: "Check Client Deadlines",
  description: "View the client deadlines table, scroll through it, and change business type.",
  tags: ["clients", "deadlines", "table", "status"],
  category: "Clients",
  hasSideEffects: false,

  async record({ page }) {
    await login(page);
    await navigateTo(page, "/clients");

    // ── Switch to "Client Deadlines" view ──────────────────────────────────
    console.log("-> Switching to Client Deadlines view...");
    const deadlinesToggle = page.locator('button:has-text("Client Deadlines")').first();
    if (await deadlinesToggle.isVisible().catch(() => false)) {
      await cursorClick(page, 'button:has-text("Client Deadlines")');
      await page.waitForLoadState("networkidle");
      await injectCursor(page);
      await wait(PAUSE.LONG);
    }

    // ── Scroll through the table fluidly ──────────────────────────────────
    console.log("-> Scrolling through the deadlines table...");

    const tableRows = page.locator("table tbody tr");
    const rowCount = await tableRows.count();

    if (rowCount > 0) {
      await cursorMove(page, "table tbody tr", 0);
      await wait(PAUSE.MEDIUM);

      if (rowCount > 1) {
        await cursorMove(page, "table tbody tr", 1);
        await wait(PAUSE.MEDIUM);
      }

      if (rowCount > 2) {
        await cursorMove(page, "table tbody tr", 2);
        await wait(PAUSE.MEDIUM);
      }
    }

    // Scroll down gradually in two smooth steps
    await page.evaluate(() => window.scrollBy({ top: 250, behavior: "smooth" }));
    await wait(800);
    await page.evaluate(() => window.scrollBy({ top: 250, behavior: "smooth" }));
    await wait(PAUSE.READ);

    if (rowCount > 4) {
      await cursorMove(page, "table tbody tr", 4);
      await wait(PAUSE.MEDIUM);
    }

    await page.evaluate(() => window.scrollBy({ top: 200, behavior: "smooth" }));
    await wait(PAUSE.MEDIUM);

    // ── Scroll back to top ─────────────────────────────────────────────────
    console.log("-> Scrolling back to top...");
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await wait(PAUSE.LONG);

    // ── Change business type to LLP (single change only) ──────────────────
    console.log("-> Switching business type to LLP...");
    const llpBtn = page.locator('button:has-text("LLP")').first();
    if (await llpBtn.isVisible().catch(() => false)) {
      await cursorClick(page, 'button:has-text("LLP")');
      await wait(PAUSE.LONG);
      await wait(PAUSE.READ);
    }

    // ── Navigate back to dashboard ─────────────────────────────────────────
    console.log("-> Navigating back to dashboard...");
    await navigateTo(page, "/dashboard");
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await wait(PAUSE.MEDIUM);
  },
};

export default demo;
